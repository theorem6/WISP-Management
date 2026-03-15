#!/bin/bash
# WISPTools EPC Check-in Agent
# Note: We don't use 'set -e' because we want to handle errors gracefully in daemon mode
# Individual functions return error codes that are checked explicitly
# Runs periodically on remote EPCs to:
#   1. Report service status and system metrics
#   2. Receive and execute queued commands
#   3. Report command results
#
# Install: curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh | sudo bash -s install
# Run once: sudo /opt/wisptools/epc-checkin-agent.sh
# Check status: systemctl status wisptools-checkin

CENTRAL_SERVER="hss.wisptools.io"
API_URL="https://${CENTRAL_SERVER}/api/epc"
CONFIG_DIR="/etc/wisptools"
LOG_FILE="/var/log/wisptools-checkin.log"
CHECKIN_INTERVAL=300  # Default 5 minutes (300 seconds) - User requested more frequent sweeps

# Git repository configuration
GIT_REPO_URL="https://github.com/theorem6/WISP-Management.git"
GIT_REPO_BRANCH="main"
GIT_REPO_DIR="/opt/wisptools/repo"
SCRIPTS_SOURCE_DIR="${GIT_REPO_DIR}/backend-services/scripts"

# Required services to monitor
REQUIRED_SERVICES="open5gs-mmed open5gs-sgwcd open5gs-sgwud open5gs-smfd open5gs-upfd snmpd"

log() {
    # Write logs to both file and stderr (for systemd journal)
    # Use >&2 to ensure logs don't contaminate stdout (important for command substitution)
    echo "$(date '+%Y-%m-%d %H:%M:%S') [CHECKIN] $1" | tee -a "$LOG_FILE" >&2
}

# Get device code
get_device_code() {
    if [ -f "$CONFIG_DIR/device-code.env" ]; then
        source "$CONFIG_DIR/device-code.env"
        echo "$DEVICE_CODE"
    elif [ -f "$CONFIG_DIR/device_code" ]; then
        cat "$CONFIG_DIR/device_code"
    else
        # Generate from MAC address
        ip link show | grep -A1 "state UP" | grep link/ether | head -1 | awk '{print $2}' | tr -d ':' | cut -c1-8 | tr '[:lower:]' '[:upper:]'
    fi
}

# Get hardware ID (primary MAC address)
get_hardware_id() {
    ip link show | grep -A1 "state UP" | grep link/ether | head -1 | awk '{print $2}' | tr '[:lower:]' '[:upper:]'
}

# Get primary IP address
get_ip_address() {
    hostname -I | awk '{print $1}'
}

# Get service status - sanitize all output
get_service_status() {
    local svc=$1
    local status="unknown"
    local uptime_sec=0
    local memory_mb=0
    
    if ! systemctl list-unit-files 2>/dev/null | grep -q "^${svc}"; then
        echo '{"status":"not-found","uptime_seconds":0,"memory_mb":0}'
        return
    fi
    
    status=$(systemctl is-active "$svc" 2>/dev/null | tr -d '\n\r' || echo "inactive")
    [ -z "$status" ] && status="inactive"
    
    if [ "$status" = "active" ]; then
        # Get uptime - with error handling
        local start_time=$(systemctl show "$svc" --property=ActiveEnterTimestamp --value 2>/dev/null | tr -d '\n\r')
        if [ -n "$start_time" ] && [ "$start_time" != "" ]; then
            local start_epoch=$(date -d "$start_time" +%s 2>/dev/null)
            local now_epoch=$(date +%s 2>/dev/null)
            if [ -n "$start_epoch" ] && [ -n "$now_epoch" ]; then
                uptime_sec=$((now_epoch - start_epoch)) 2>/dev/null || uptime_sec=0
            fi
        fi
        
        # Get memory usage
        local pid=$(systemctl show "$svc" --property=MainPID --value 2>/dev/null | tr -d '\n\r')
        if [ -n "$pid" ] && [ "$pid" != "0" ]; then
            memory_mb=$(ps -o rss= -p "$pid" 2>/dev/null | awk '{printf "%.0f", $1/1024}') || memory_mb=0
            [ -z "$memory_mb" ] && memory_mb=0
        fi
    fi
    
    # Ensure numeric values
    [ -z "$uptime_sec" ] && uptime_sec=0
    [ -z "$memory_mb" ] && memory_mb=0
    
    echo "{\"status\":\"$status\",\"uptime_seconds\":$uptime_sec,\"memory_mb\":$memory_mb}"
}

# Get system metrics - using proper CPU calculation that accounts for multi-core systems
get_system_metrics() {
    # Calculate CPU usage from /proc/stat (most accurate, accounts for all cores, fast)
    local cpu_percent=0
    local stat_file="/tmp/cpu_stat_prev"
    
    if [ -f /proc/stat ]; then
        # Read current CPU stats
        local cpu_line=$(head -n 1 /proc/stat)
        local user=$(echo "$cpu_line" | awk '{print $2}')
        local nice=$(echo "$cpu_line" | awk '{print $3}')
        local system=$(echo "$cpu_line" | awk '{print $4}')
        local idle=$(echo "$cpu_line" | awk '{print $5}')
        local iowait=$(echo "$cpu_line" | awk '{print $6}')
        local irq=$(echo "$cpu_line" | awk '{print $7}')
        local softirq=$(echo "$cpu_line" | awk '{print $8}')
        
        local total=$((user + nice + system + idle + iowait + irq + softirq))
        local idle_total=$((idle + iowait))
        
        # Get previous stats if available
        if [ -f "$stat_file" ]; then
            local prev_line=$(cat "$stat_file")
            local prev_user=$(echo "$prev_line" | awk '{print $2}')
            local prev_nice=$(echo "$prev_line" | awk '{print $3}')
            local prev_system=$(echo "$prev_line" | awk '{print $4}')
            local prev_idle=$(echo "$prev_line" | awk '{print $5}')
            local prev_iowait=$(echo "$prev_line" | awk '{print $6}')
            local prev_irq=$(echo "$prev_line" | awk '{print $7}')
            local prev_softirq=$(echo "$prev_line" | awk '{print $8}')
            
            local prev_total=$((prev_user + prev_nice + prev_system + prev_idle + prev_iowait + prev_irq + prev_softirq))
            local prev_idle_total=$((prev_idle + prev_iowait))
            
            local total_delta=$((total - prev_total))
            local idle_delta=$((idle_total - prev_idle_total))
            
            if [ "$total_delta" -gt 0 ]; then
                local used=$((total_delta - idle_delta))
                cpu_percent=$((used * 100 / total_delta))
            fi
        fi
        
        # Save current stats for next call
        echo "$cpu_line" > "$stat_file" 2>/dev/null || true
    fi
    
    # Fallback to top if /proc/stat method didn't work or no previous data
    if [ -z "$cpu_percent" ] || [ "$cpu_percent" -lt 0 ] || [ "$cpu_percent" -gt 100 ]; then
        # Use top - the %Cpu(s) line shows aggregate across all cores
        local cpu_line=$(top -bn1 | grep "^%Cpu" 2>/dev/null | head -1)
        if [ -n "$cpu_line" ]; then
            # Extract all CPU percentages and calculate used
            local us=$(echo "$cpu_line" | grep -oE '[0-9.]+%us' | grep -oE '[0-9.]+' || echo "0")
            local sy=$(echo "$cpu_line" | grep -oE '[0-9.]+%sy' | grep -oE '[0-9.]+' || echo "0")
            local ni=$(echo "$cpu_line" | grep -oE '[0-9.]+%ni' | grep -oE '[0-9.]+' || echo "0")
            local id=$(echo "$cpu_line" | grep -oE '[0-9.]+%id' | grep -oE '[0-9.]+' || echo "100")
            # Calculate used percentage
            cpu_percent=$(awk "BEGIN {printf \"%.0f\", $us + $sy + $ni}" 2>/dev/null || echo "0")
        fi
    fi
    
    [ -z "$cpu_percent" ] && cpu_percent=0
    # Ensure value is between 0 and 100
    [ "$cpu_percent" -lt 0 ] && cpu_percent=0
    [ "$cpu_percent" -gt 100 ] && cpu_percent=100
    local mem_total=$(free -m | awk 'NR==2{print $2}' 2>/dev/null)
    [ -z "$mem_total" ] && mem_total=1
    local mem_used=$(free -m | awk 'NR==2{print $3}' 2>/dev/null)
    [ -z "$mem_used" ] && mem_used=0
    local mem_percent=$((mem_used * 100 / mem_total))
    local disk_info=$(df -m / 2>/dev/null | awk 'NR==2{print $2" "$3" "$5}' | tr -d '%')
    local disk_total=$(echo "$disk_info" | awk '{printf "%.1f", $1/1024}' 2>/dev/null)
    [ -z "$disk_total" ] && disk_total=0
    local disk_used=$(echo "$disk_info" | awk '{printf "%.1f", $2/1024}' 2>/dev/null)
    [ -z "$disk_used" ] && disk_used=0
    local disk_percent=$(echo "$disk_info" | awk '{print $3}' 2>/dev/null)
    [ -z "$disk_percent" ] && disk_percent=0
    local uptime_sec=$(awk '{print int($1)}' /proc/uptime 2>/dev/null)
    [ -z "$uptime_sec" ] && uptime_sec=0
    local load1=$(awk '{print $1}' /proc/loadavg 2>/dev/null)
    [ -z "$load1" ] && load1=0
    local load5=$(awk '{print $2}' /proc/loadavg 2>/dev/null)
    [ -z "$load5" ] && load5=0
    local load15=$(awk '{print $3}' /proc/loadavg 2>/dev/null)
    [ -z "$load15" ] && load15=0
    
    # Build JSON with proper error handling
    echo "{\"uptime_seconds\":$uptime_sec,\"load_average\":[$load1,$load5,$load15],\"cpu_percent\":$cpu_percent,\"memory_percent\":$mem_percent,\"memory_total_mb\":$mem_total,\"memory_used_mb\":$mem_used,\"disk_percent\":$disk_percent,\"disk_total_gb\":$disk_total,\"disk_used_gb\":$disk_used}"
}

# Get network info - collect interface statistics for SNMP monitoring
get_network_info() {
    local ip=$(get_ip_address)
    [ -z "$ip" ] && ip="unknown"
    
    # Get primary interface (first non-loopback interface with IP)
    local primary_interface=""
    if [ -d /sys/class/net ]; then
        for iface in /sys/class/net/*; do
            local ifname=$(basename "$iface")
            # Skip loopback
            if [ "$ifname" = "lo" ]; then
                continue
            fi
            # Check if interface is up
            if [ -f "$iface/operstate" ] && [ "$(cat "$iface/operstate" 2>/dev/null)" = "up" ]; then
                # Check if interface has an IP
                if ip addr show "$ifname" 2>/dev/null | grep -q "inet "; then
                    primary_interface="$ifname"
                    break
                fi
            fi
        done
    fi
    
    # If no primary interface found, try to get from IP route
    if [ -z "$primary_interface" ]; then
        primary_interface=$(ip route get 8.8.8.8 2>/dev/null | grep -oP 'dev \K\S+' | head -1)
    fi
    
    # Get interface statistics from /proc/net/dev
    local interface_in_octets=0
    local interface_out_octets=0
    local interface_in_errors=0
    local interface_out_errors=0
    local interface_speed=0
    local interface_status="down"
    
    if [ -n "$primary_interface" ] && [ -f /proc/net/dev ]; then
        # Get interface stats from /proc/net/dev
        local if_stats=$(grep "^[[:space:]]*${primary_interface}:" /proc/net/dev 2>/dev/null)
        if [ -n "$if_stats" ]; then
            # Format: interface: bytes packets errs drop fifo frame compressed multicast bytes packets errs drop fifo colls carrier compressed
            interface_in_octets=$(echo "$if_stats" | awk '{print $2}')
            interface_in_errors=$(echo "$if_stats" | awk '{print $4}')
            interface_out_octets=$(echo "$if_stats" | awk '{print $10}')
            interface_out_errors=$(echo "$if_stats" | awk '{print $12}')
        fi
        
        # Get interface speed from /sys/class/net
        if [ -f "/sys/class/net/${primary_interface}/speed" ]; then
            interface_speed=$(cat "/sys/class/net/${primary_interface}/speed" 2>/dev/null || echo "0")
            # Convert from Mbps to bps for consistency
            interface_speed=$((interface_speed * 1000000))
        fi
        
        # Get interface status
        if [ -f "/sys/class/net/${primary_interface}/operstate" ]; then
            interface_status=$(cat "/sys/class/net/${primary_interface}/operstate" 2>/dev/null || echo "down")
        fi
    fi
    
    # Build interfaces array (just primary interface for now)
    local interfaces_json="[]"
    if [ -n "$primary_interface" ]; then
        interfaces_json="[{\"name\":\"$primary_interface\",\"ip\":\"$ip\",\"status\":\"$interface_status\"}]"
    fi
    
    # Return comprehensive network info
    echo "{\"ip_address\":\"$ip\",\"primary_interface\":\"$primary_interface\",\"interface_in_octets\":$interface_in_octets,\"interface_out_octets\":$interface_out_octets,\"interface_in_errors\":$interface_in_errors,\"interface_out_errors\":$interface_out_errors,\"interface_speed\":$interface_speed,\"interface_status\":\"$interface_status\",\"interfaces\":$interfaces_json}"
}

# Get file hash (SHA256) if sha256sum is available, otherwise use md5sum
get_file_hash() {
    local file_path=$1
    if [ ! -f "$file_path" ]; then
        echo "missing"
        return
    fi
    
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$file_path" 2>/dev/null | cut -d' ' -f1 | tr -d '\n\r' || echo "unknown"
    elif command -v md5sum >/dev/null 2>&1; then
        md5sum "$file_path" 2>/dev/null | cut -d' ' -f1 | tr -d '\n\r' || echo "unknown"
    else
        # Fallback: use stat for modification time
        stat -c %Y "$file_path" 2>/dev/null | tr -d '\n\r' || echo "unknown"
    fi
}

# Get version info - simple JSON with sanitization
get_versions() {
    local os_info=$(grep PRETTY_NAME /etc/os-release 2>/dev/null | cut -d'"' -f2 | tr -d '\n\r' | sed 's/["\\\t]//g' || echo "Unknown")
    [ -z "$os_info" ] && os_info="Unknown"
    local kernel=$(uname -r 2>/dev/null | tr -d '\n\r' || echo "unknown")
    [ -z "$kernel" ] && kernel="unknown"
    local open5gs_version=$(dpkg -l 2>/dev/null | grep open5gs-mme | awk '{print $3}' | head -1 | tr -d '\n\r')
    [ -z "$open5gs_version" ] && open5gs_version="not installed"
    
    # Get script versions/hashes - CRITICAL: Must report ALL script hashes to prevent duplicate updates
    local agent_hash=$(get_file_hash "/opt/wisptools/epc-checkin-agent.sh")
    local snmp_hash=""
    local snmp_js_hash=""
    local ping_monitor_hash=""
    
    # Get hash for bash version (if exists)
    if [ -f "/opt/wisptools/epc-snmp-discovery.sh" ]; then
        snmp_hash=$(get_file_hash "/opt/wisptools/epc-snmp-discovery.sh")
    fi
    
    # Get hash for Node.js version (if exists)
    if [ -f "/opt/wisptools/epc-snmp-discovery.js" ]; then
        snmp_js_hash=$(get_file_hash "/opt/wisptools/epc-snmp-discovery.js")
    fi
    
    # Get hash for ping monitor (if exists) - THIS WAS MISSING!
    if [ -f "/opt/wisptools/epc-ping-monitor.js" ]; then
        ping_monitor_hash=$(get_file_hash "/opt/wisptools/epc-ping-monitor.js")
    fi
    
    # Build scripts object - include ALL scripts that might be updated
    local scripts_json="\"scripts\":{\"epc-checkin-agent.sh\":{\"hash\":\"$agent_hash\"}"
    [ -n "$snmp_hash" ] && scripts_json="${scripts_json},\"epc-snmp-discovery.sh\":{\"hash\":\"$snmp_hash\"}"
    [ -n "$snmp_js_hash" ] && scripts_json="${scripts_json},\"epc-snmp-discovery.js\":{\"hash\":\"$snmp_js_hash\"}"
    [ -n "$ping_monitor_hash" ] && scripts_json="${scripts_json},\"epc-ping-monitor.js\":{\"hash\":\"$ping_monitor_hash\"}"
    scripts_json="${scripts_json}}"
    
    echo "{\"os\":\"$os_info\",\"kernel\":\"$kernel\",\"open5gs\":\"$open5gs_version\",$scripts_json}"
}

# Execute a command
# Returns 0 on success (command executed and result reported), 1 on failure
execute_command() {
    local cmd_id=$1
    local cmd_type=$2
    local action=$3
    local target_services=$4
    local script_content=$5
    local script_url=$6
    local cmd_json_file=$7  # Path to JSON file containing full command (for config_data extraction)
    
    log "Executing command $cmd_id: $cmd_type / $action"
    
    local result_success=true
    local result_output=""
    local result_error=""
    local exit_code=0
    
    case "$cmd_type" in
        service_control)
            if [ "$target_services" = "all" ] || [ -z "$target_services" ]; then
                target_services="$REQUIRED_SERVICES"
            fi
            
            for svc in $target_services; do
                log "  -> $action $svc"
                case "$action" in
                    start|stop|restart)
                        if output=$(systemctl $action "$svc" 2>&1); then
                            result_output+="$svc: $action OK\n"
                        else
                            result_output+="$svc: $action FAILED - $output\n"
                            result_success=false
                        fi
                        ;;
                    enable|disable)
                        systemctl $action "$svc" 2>&1
                        ;;
                    status)
                        result_output+="$svc: $(systemctl is-active $svc)\n"
                        ;;
                esac
            done
            ;;
            
        reboot)
            log "  -> System reboot requested"
            result_output="Rebooting system..."
            # Report result before rebooting
            report_command_result "$cmd_id" "true" "$result_output" "" 0
            sync
            sleep 2
            reboot
            ;;
            
        update)
            log "  -> System update requested"
            if output=$(apt-get update -qq && apt-get upgrade -y 2>&1); then
                result_output="Update completed: $output"
            else
                result_success=false
                result_error="Update failed: $output"
                exit_code=1
            fi
            ;;
            
        script|script_execution)
            log "  -> Executing script"
            local script_file="/tmp/wisptools-cmd-$cmd_id.sh"
            
            if [ -n "$script_content" ]; then
                log "  -> Script provided as content (${#script_content} chars)"
                echo "$script_content" > "$script_file" 2>&1 || {
                    result_success=false
                    result_error="Failed to write script file"
                    exit_code=1
                    log "ERROR: Failed to write script to $script_file"
                }
            elif [ -n "$script_url" ]; then
                log "  -> Downloading script from $script_url"
                if ! curl -fsSL "$script_url" -o "$script_file" 2>&1; then
                    result_success=false
                    result_error="Failed to download script from $script_url"
                    exit_code=1
                    log "ERROR: Failed to download script: $result_error"
                else
                    log "  -> Script downloaded successfully ($(stat -c%s "$script_file" 2>/dev/null || echo 0) bytes)"
                fi
            else
                result_success=false
                result_error="No script content or URL provided"
                exit_code=1
                log "ERROR: No script content or URL in command"
            fi
            
            if [ "$result_success" = true ] && [ -f "$script_file" ]; then
                chmod +x "$script_file" 2>&1 || log "WARNING: Failed to chmod script file"
                
                # Log script first few lines for debugging
                log "  -> Script preview: $(head -3 "$script_file" | tr '\n' '; ')"
                
                # Check if script will restart daemon - if so, we need to report result first
                local will_restart_daemon=false
                if grep -q "systemctl.*restart.*wisptools-checkin\|restart.*checkin" "$script_file" 2>/dev/null; then
                    will_restart_daemon=true
                    log "  -> WARNING: Script will restart daemon - will report result before restart"
                fi
                
                # Capture both stdout and stderr
                log "  -> Running script..."
                if output=$("$script_file" 2>&1); then
                    result_output="$output"
                    log "  -> Script executed successfully"
                    log "  -> Output: $(echo "$output" | head -5 | tr '\n' '; ')"
                else
                    exit_code=$?
                    result_success=false
                    result_error="$output"
                    log "ERROR: Script execution failed with exit code $exit_code"
                    log "ERROR: Script output: $(echo "$output" | head -10 | tr '\n' '; ')"
                fi
                
                # CRITICAL: Report result in background process that survives daemon restart
                # The script may restart the daemon, killing this process before HTTP request completes
                # So we report in a background process that will continue even if this process dies
                log "  -> Reporting command result in background (survives daemon restart)"
                
                # Get device code for background script
                local device_code=$(get_device_code)
                
                # Create a temporary script to report the result
                local report_script="/tmp/report-result-${cmd_id}.sh"
                # Escape output and error for safe JSON embedding
                # Use base64 encoding to avoid all escaping issues
                local output_b64=$(echo -n "$result_output" | base64 -w 0 2>/dev/null || echo -n "$result_output" | base64 2>/dev/null | tr -d '\n')
                local error_b64=$(echo -n "$result_error" | base64 -w 0 2>/dev/null || echo -n "$result_error" | base64 2>/dev/null | tr -d '\n')
                
                cat > "$report_script" << 'REPORTEOF'
#!/bin/bash
# Background result reporting script - survives daemon restart
API_URL="https://hss.wisptools.io/api/epc"
DEVICE_CODE="REPORTEOF
                echo "$device_code" >> "$report_script"
                cat >> "$report_script" << REPORTEOF
"
CMD_ID="REPORTEOF
                echo "$cmd_id" >> "$report_script"
                cat >> "$report_script" << REPORTEOF
"
SUCCESS="REPORTEOF
                echo "$result_success" >> "$report_script"
                cat >> "$report_script" << REPORTEOF
"
OUTPUT_B64="REPORTEOF
                echo "$output_b64" >> "$report_script"
                cat >> "$report_script" << REPORTEOF
"
ERROR_B64="REPORTEOF
                echo "$error_b64" >> "$report_script"
                cat >> "$report_script" << 'REPORTEOF'
"
EXIT_CODE=REPORTEOF
                echo "$exit_code" >> "$report_script"
                cat >> "$report_script" << 'REPORTEOF'

# Decode base64 output/error
OUTPUT=$(echo -n "$OUTPUT_B64" | base64 -d 2>/dev/null || echo "$OUTPUT_B64")
ERROR=$(echo -n "$ERROR_B64" | base64 -d 2>/dev/null || echo "$ERROR_B64")

# Escape for JSON
OUTPUT_JSON=$(echo -n "$OUTPUT" | jq -Rs . 2>/dev/null || echo "\"$(echo -n "$OUTPUT" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | tr '\n' ' ')\"")
ERROR_JSON=$(echo -n "$ERROR" | jq -Rs . 2>/dev/null || echo "\"$(echo -n "$ERROR" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | tr '\n' ' ')\"")

# Wait a moment for daemon restart to complete
sleep 2

# Report result with retries
for i in 1 2 3; do
    if command -v timeout >/dev/null 2>&1; then
        response=$(timeout 30 curl -s -w "\n%{http_code}" -X POST "${API_URL}/checkin/commands/${CMD_ID}/result" \
            -H "Content-Type: application/json" \
            -H "X-Device-Code: ${DEVICE_CODE}" \
            -d "{\"success\":${SUCCESS},\"output\":${OUTPUT_JSON},\"error\":${ERROR_JSON},\"exit_code\":${EXIT_CODE}}" \
            --max-time 25 \
            --connect-timeout 10 \
            2>&1)
        http_code=$(echo "$response" | tail -n1)
    else
        response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/checkin/commands/${CMD_ID}/result" \
            -H "Content-Type: application/json" \
            -H "X-Device-Code: ${DEVICE_CODE}" \
            -d "{\"success\":${SUCCESS},\"output\":${OUTPUT_JSON},\"error\":${ERROR_JSON},\"exit_code\":${EXIT_CODE}}" \
            --max-time 25 \
            --connect-timeout 10 \
            2>&1)
        http_code=$(echo "$response" | tail -n1)
    fi
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') [CHECKIN] Command ${CMD_ID} result reported successfully (attempt $i)" >> /var/log/wisptools-checkin.log
        exit 0
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S') [CHECKIN] ERROR: Failed to report command ${CMD_ID} result (HTTP $http_code, attempt $i)" >> /var/log/wisptools-checkin.log
        if [ $i -lt 3 ]; then
            sleep 5
        fi
    fi
done

# If all retries failed, log it
echo "$(date '+%Y-%m-%d %H:%M:%S') [CHECKIN] ERROR: Command ${CMD_ID} result reporting failed after 3 attempts" >> /var/log/wisptools-checkin.log
REPORTEOF
                chmod +x "$report_script"
                
                # Run in background with nohup - this will survive daemon restart
                # Use nohup and redirect to log file so we can see if it worked
                nohup bash "$report_script" >> /var/log/wisptools-checkin.log 2>&1 &
                local report_pid=$!
                log "  -> Result reporting started in background (PID: $report_pid, script: $report_script)"
                
                # Don't wait for it - let it run independently
                # The background script will retry up to 3 times if needed
                
                rm -f "$script_file"
            elif [ "$result_success" = false ]; then
                log "ERROR: Script file not created or command already failed"
            fi
            ;;
            
        config_update)
            log "  -> Applying configuration update"
            
            # Extract config_data from command JSON file
            local config_data=""
            if [ -n "$cmd_json_file" ] && [ -f "$cmd_json_file" ]; then
                # First check if config_data exists in the JSON
                local has_config_data=$(cat "$cmd_json_file" | jq -r 'if .config_data != null then "yes" else "no" end' 2>/dev/null || echo "no")
                log "  -> Command JSON file found. Has config_data: $has_config_data"
                
                if [ "$has_config_data" = "yes" ]; then
                    config_data=$(cat "$cmd_json_file" | jq -c '.config_data' 2>/dev/null)
                    local config_size=${#config_data}
                    log "  -> Extracted config_data (${config_size} chars): ${config_data:0:200}..."
                    
                    # Validate it's valid JSON
                    if ! echo "$config_data" | jq . >/dev/null 2>&1; then
                        log "ERROR: Extracted config_data is not valid JSON"
                        config_data=""
                    fi
                else
                    log "ERROR: Command JSON does not contain config_data field"
                    log "Command JSON keys: $(cat "$cmd_json_file" | jq -r 'keys | join(", ")' 2>/dev/null || echo "unknown")"
                    log "Full command JSON: $(cat "$cmd_json_file" 2>/dev/null | head -c 500)"
                fi
            else
                log "ERROR: Command JSON file not found: ${cmd_json_file:-none}"
            fi
            
            if [ -z "$config_data" ] || [ "$config_data" = "null" ] || [ "$config_data" = "{}" ]; then
                result_success=false
                result_error="No config_data provided in command"
                log "ERROR: Config data is empty or invalid after extraction"
                exit_code=1
            else
                # Store configuration for later use
                local config_file="/etc/wisptools/epc-config.json"
                echo "$config_data" > "$config_file" 2>/dev/null || {
                    result_success=false
                    result_error="Failed to write config file"
                    exit_code=1
                }
                
                if [ "$result_success" = true ]; then
                    # Extract key config values
                    local site_name=$(echo "$config_data" | jq -r '.site_name // empty')
                    local site_id=$(echo "$config_data" | jq -r '.site_id // empty')
                    
                    # Update registration.json if it exists
                    local reg_file="/etc/wisptools/registration.json"
                    if [ -f "$reg_file" ]; then
                        local reg_data=$(cat "$reg_file" 2>/dev/null || echo "{}")
                        reg_data=$(echo "$reg_data" | jq --arg site_name "$site_name" --arg site_id "$site_id" \
                            '.config.site_name = $site_name | .config.site_id = $site_id')
                        echo "$reg_data" > "$reg_file" 2>/dev/null || true
                    fi
                    
                    result_output="Configuration updated successfully"
                    if [ -n "$site_name" ]; then
                        result_output+="\nSite: $site_name"
                    fi
                    if [ -n "$site_id" ]; then
                        result_output+="\nSite ID: $site_id"
                    fi
                    
                    log "Configuration update applied - Site: ${site_name:-N/A}, Site ID: ${site_id:-N/A}"
                fi
            fi
            
            # Clean up command JSON file
            [ -n "$cmd_json_file" ] && [ -f "$cmd_json_file" ] && rm -f "$cmd_json_file"
            ;;
            
        *)
            result_success=false
            result_error="Unknown command type: $cmd_type"
            exit_code=1
            ;;
    esac
    
    # Report result (unless already reported in script_execution case)
    # Script execution reports immediately to avoid daemon restart killing the process
    if [ "$cmd_type" != "script_execution" ] && [ "$cmd_type" != "script" ]; then
        report_command_result "$cmd_id" "$result_success" "$result_output" "$result_error" "$exit_code"
    fi
    # Note: script_execution already reported result above, before any daemon restart
}

# Report command result back to server
report_command_result() {
    local cmd_id=$1
    local success=$2
    local output=$3
    local error=$4
    local exit_code=$5
    
    local device_code=$(get_device_code)
    
    # Escape strings for JSON
    output=$(echo "$output" | sed 's/"/\\"/g' | tr '\n' ' ')
    error=$(echo "$error" | sed 's/"/\\"/g' | tr '\n' ' ')
    
    # Report command result with timeout to prevent hanging (CRITICAL - must succeed to prevent duplicate commands)
    # Use timeout command for extra safety in case curl hangs
    local result_reported=false
    if command -v timeout >/dev/null 2>&1; then
        local result_response=$(timeout 35 curl -s -w "\n%{http_code}" -X POST "${API_URL}/checkin/commands/${cmd_id}/result" \
            -H "Content-Type: application/json" \
            -H "X-Device-Code: $device_code" \
            -d "{
                \"success\": $success,
                \"output\": \"$output\",
                \"error\": \"$error\",
                \"exit_code\": $exit_code
            }" \
            --max-time 30 \
            --connect-timeout 10 \
            2>&1)
        local result_http_code=$(echo "$result_response" | tail -n1)
        if [ "$result_http_code" = "200" ] || [ "$result_http_code" = "201" ]; then
            result_reported=true
            log "Command $cmd_id result reported successfully: success=$success"
        else
            log "ERROR: Failed to report command result (HTTP $result_http_code) - command may be re-queued"
            log "Response: $(echo "$result_response" | head -c 200)"
        fi
    else
        # Fallback if timeout command not available
        local result_response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/checkin/commands/${cmd_id}/result" \
            -H "Content-Type: application/json" \
            -H "X-Device-Code: $device_code" \
            -d "{
                \"success\": $success,
                \"output\": \"$output\",
                \"error\": \"$error\",
                \"exit_code\": $exit_code
            }" \
            --max-time 30 \
            --connect-timeout 10 \
            2>&1)
        local result_http_code=$(echo "$result_response" | tail -n1)
        if [ "$result_http_code" = "200" ] || [ "$result_http_code" = "201" ]; then
            result_reported=true
            log "Command $cmd_id result reported successfully: success=$success"
        else
            log "ERROR: Failed to report command result (HTTP $result_http_code) - command may be re-queued"
            log "Response: $(echo "$result_response" | head -c 200)"
        fi
    fi
    
    if [ "$result_reported" = false ]; then
        log "ERROR: Command $cmd_id result NOT reported successfully - command may appear again on next check-in"
        return 1
    else
        # Don't log "fully processed" here for script_execution - it's already logged above
        # and the daemon might restart soon
        if [ "$cmd_type" != "script_execution" ] && [ "$cmd_type" != "script" ]; then
            log "Command $cmd_id fully processed: executed and result reported"
        fi
        return 0
    fi
}

# Main check-in function
do_checkin() {
    local device_code=$(get_device_code)
    local hardware_id=$(get_hardware_id)
    local ip_address=$(get_ip_address)
    
    if [ -z "$device_code" ]; then
        log "ERROR: No device code found"
        return 1
    fi
    
    log "Checking in as $device_code from $ip_address"
    
    # Run ping cycle BEFORE check-in (synchronously, every 5 minutes)
    # Ensure ping monitor script is available
    if command -v node >/dev/null 2>&1; then
        # Get ping monitor script from git repository if missing
        if [ ! -f /opt/wisptools/epc-ping-monitor.js ]; then
            log "Ping monitor script not found, checking git repository..."
            # Try to get from git repository first
            if [ -d "$GIT_REPO_DIR" ] && [ -f "${SCRIPTS_SOURCE_DIR}/epc-ping-monitor.js" ]; then
                cp "${SCRIPTS_SOURCE_DIR}/epc-ping-monitor.js" /opt/wisptools/epc-ping-monitor.js
                chmod +x /opt/wisptools/epc-ping-monitor.js
                log "Ping monitor script copied from git repository"
            elif [ -d "$GIT_REPO_DIR" ]; then
                # Repository exists but script missing - try to update repo
                log "Updating git repository to get ping monitor script..."
                cd "$GIT_REPO_DIR" && git fetch origin "$GIT_REPO_BRANCH" >/dev/null 2>&1 && git reset --hard "origin/${GIT_REPO_BRANCH}" >/dev/null 2>&1
                if [ -f "${SCRIPTS_SOURCE_DIR}/epc-ping-monitor.js" ]; then
                    cp "${SCRIPTS_SOURCE_DIR}/epc-ping-monitor.js" /opt/wisptools/epc-ping-monitor.js
                    chmod +x /opt/wisptools/epc-ping-monitor.js
                    log "Ping monitor script copied from updated git repository"
                else
                    log "WARNING: Ping monitor script not found in repository, falling back to download"
                    curl -fsSL "https://${CENTRAL_SERVER}/downloads/scripts/epc-ping-monitor.js" -o /opt/wisptools/epc-ping-monitor.js 2>/dev/null && \
                    chmod +x /opt/wisptools/epc-ping-monitor.js && \
                    log "Ping monitor script downloaded successfully" || \
                    log "WARNING: Failed to download ping monitor script"
                fi
            else
                # No git repository - fallback to download
                log "Git repository not available, downloading ping monitor script..."
                curl -fsSL "https://${CENTRAL_SERVER}/downloads/scripts/epc-ping-monitor.js" -o /opt/wisptools/epc-ping-monitor.js 2>/dev/null && \
                chmod +x /opt/wisptools/epc-ping-monitor.js && \
                log "Ping monitor script downloaded successfully" || \
                log "WARNING: Failed to download ping monitor script"
            fi
        fi
        
        # Run ping cycle synchronously BEFORE check-in (every 5 minutes)
        if [ -f /opt/wisptools/epc-ping-monitor.js ]; then
            log "Running ping cycle before check-in..."
            if node /opt/wisptools/epc-ping-monitor.js cycle >> "$LOG_FILE" 2>&1; then
                log "Ping cycle completed successfully"
            else
                local ping_exit=$?
                log "WARNING: Ping cycle exited with code $ping_exit - check logs for details"
                log "Last 5 lines of ping monitor output:"
                tail -5 "$LOG_FILE" | grep -i "ping\|ERROR\|WARN" | tail -5 | while read line; do log "  $line"; done || true
            fi
        else
            log "WARNING: Ping monitor script not found at /opt/wisptools/epc-ping-monitor.js"
            log "Attempting to download..."
            curl -fsSL "https://${CENTRAL_SERVER}/downloads/scripts/epc-ping-monitor.js" -o /opt/wisptools/epc-ping-monitor.js 2>&1 && \
            chmod +x /opt/wisptools/epc-ping-monitor.js && \
            log "Ping monitor script downloaded" || \
            log "ERROR: Failed to download ping monitor script"
        fi
        
        # Run hourly subnet ping sweep (separate from regular ping cycle)
        # Best practice: Hourly is appropriate for network discovery sweeps
        local last_sweep_file="/tmp/last-ping-sweep"
        local sweep_interval=${SUBNET_SWEEP_INTERVAL:-300}  # Default 5 minutes (300 seconds) - User requested more frequent sweeps
        local should_sweep=true
        if [ -f "$last_sweep_file" ]; then
            local last_sweep=$(cat "$last_sweep_file" 2>/dev/null || echo "0")
            local now=$(date +%s)
            local elapsed=$((now - last_sweep))
            if [ $elapsed -lt $sweep_interval ]; then
                should_sweep=false
            fi
        fi
        
        if [ "$should_sweep" = true ] && [ -f /opt/wisptools/epc-ping-monitor.js ]; then
            log "Running hourly subnet ping sweep..."
            node /opt/wisptools/epc-ping-monitor.js sweep >> "$LOG_FILE" 2>&1 &
            local sweep_pid=$!
            echo "$(date +%s)" > "$last_sweep_file"
            log "Subnet ping sweep started in background (PID: $sweep_pid)"
        fi
    fi
    
    # Collect service status - build JSON manually
    local services_json="{"
    local first=true
    for svc in $REQUIRED_SERVICES; do
        local status=$(get_service_status "$svc")
        if [ "$first" = true ]; then
            first=false
        else
            services_json="$services_json,"
        fi
        services_json="$services_json\"$svc\":$status"
    done
    services_json="$services_json}"
    
    # Collect system metrics
    local system_json=$(get_system_metrics)
    local network_json=$(get_network_info)
    local versions_json=$(get_versions)
    
    # Collect recent logs (last 50 lines from check-in log, max 5000 chars)
    # Sanitize control characters before building JSON
    local logs_json="[]"
    if [ -f "$LOG_FILE" ] && command -v jq >/dev/null 2>&1; then
        local recent_logs=$(tail -n 50 "$LOG_FILE" 2>/dev/null | head -c 5000 | tr -d '\000-\010\013-\037' || echo "")
        if [ -n "$recent_logs" ]; then
            logs_json=$(echo "$recent_logs" | jq -Rs '[split("\n") | map(select(length > 0)) | .[] | {
                "source": "checkin-agent",
                "level": "info",
                "message": .
            }]' 2>/dev/null || echo "[]")
        fi
    fi
    
    # Build check-in payload using jq to ensure proper JSON escaping
    local payload
    if command -v jq >/dev/null 2>&1; then
        payload=$(jq -n \
            --arg device_code "$device_code" \
            --arg hardware_id "$hardware_id" \
            --arg ip_address "$ip_address" \
            --argjson services "$services_json" \
            --argjson system "$system_json" \
            --argjson network "$network_json" \
            --argjson versions "$versions_json" \
            --argjson logs "$logs_json" \
            '{
                device_code: $device_code,
                hardware_id: $hardware_id,
                ip_address: $ip_address,
                services: $services,
                system: $system,
                network: $network,
                versions: $versions,
                logs: $logs
            }' 2>/dev/null)
        
        # Fallback to manual construction if jq fails
        if [ -z "$payload" ] || [ "$payload" = "null" ]; then
            payload="{\"device_code\":\"$device_code\",\"hardware_id\":\"$hardware_id\",\"ip_address\":\"$ip_address\",\"services\":$services_json,\"system\":$system_json,\"network\":$network_json,\"versions\":$versions_json,\"logs\":$logs_json}"
        fi
    else
        # Manual construction without logs if jq not available
        payload="{\"device_code\":\"$device_code\",\"hardware_id\":\"$hardware_id\",\"ip_address\":\"$ip_address\",\"services\":$services_json,\"system\":$system_json,\"network\":$network_json,\"versions\":$versions_json,\"logs\":[]}"
    fi
    
    # Send check-in with HTTP status code capture
    # Use timeouts to prevent hanging: 30s total, 10s connect, 20s transfer
    # Wrap curl with timeout command if available for extra safety
    local http_code=0
    local response
    local curl_exit_code
    
    if command -v timeout >/dev/null 2>&1; then
        # Use timeout command for extra protection against hanging
        response=$(timeout 35 curl -s -w "\n%{http_code}" -X POST "${API_URL}/checkin" \
            -H "Content-Type: application/json" \
            -H "X-Device-Code: $device_code" \
            -d "$payload" \
            --max-time 30 \
            --connect-timeout 10 \
            --retry 0 \
            --retry-delay 0 \
            2>&1)
        curl_exit_code=$?
        
        # Check if timeout command killed curl (exit code 124 = timeout)
        if [ $curl_exit_code -eq 124 ]; then
            log "ERROR: Check-in timed out after 35 seconds (timeout command)"
            return 1
        fi
    else
        # Fallback if timeout command not available (use curl's built-in timeouts)
        response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/checkin" \
            -H "Content-Type: application/json" \
            -H "X-Device-Code: $device_code" \
            -d "$payload" \
            --max-time 30 \
            --connect-timeout 10 \
            --retry 0 \
            --retry-delay 0 \
            2>&1)
        curl_exit_code=$?
    fi
    
    # Extract HTTP status code (last line)
    http_code=$(echo "$response" | tail -n1)
    response=$(echo "$response" | sed '$d')  # Remove last line (HTTP code)
    
    # Check for curl errors (exit code != 0) or HTTP 000 (connection failed)
    if [ $curl_exit_code -ne 0 ] || [ "$http_code" = "000" ]; then
        log "ERROR: Check-in failed - connection error (curl exit: $curl_exit_code, HTTP: $http_code)"
        if [ -n "$response" ]; then
            log "Error details: $(echo "$response" | head -c 200)"
        fi
        return 1
    fi
    
    # Only check for HTML on error status codes (4xx, 5xx)
    # Don't check for HTML on successful responses (2xx) as they should be JSON
    if [ "$http_code" -ge 400 ]; then
        # Check if response starts with HTML document structure
        if echo "$response" | head -c 100 | grep -qiE "^[[:space:]]*<(!DOCTYPE|html|head|body)"; then
            log "ERROR: Check-in failed - Backend returned HTML error page (HTTP $http_code)"
            log "Response preview: $(echo "$response" | head -c 200)"
            return 1
        fi
        
        # Also check for nginx error pages by looking for specific HTML structure
        if echo "$response" | grep -qi "<center><h1>.*Bad Gateway\|<title>.*Bad Gateway"; then
            log "ERROR: Check-in failed - Backend returned HTML error page (HTTP $http_code)"
            log "Response preview: $(echo "$response" | head -c 200)"
            return 1
        fi
    fi
    
    # Validate JSON response before parsing
    if ! echo "$response" | jq . >/dev/null 2>&1; then
        log "ERROR: Check-in failed - Invalid JSON response (HTTP $http_code)"
        log "Response preview: $(echo "$response" | head -c 200)"
        return 1
    fi
    
    # Parse response
    local status=$(echo "$response" | jq -r '.status // "error"')
    
    if [ "$status" = "ok" ]; then
        local epc_id=$(echo "$response" | jq -r '.epc_id')
        local tenant_id=$(echo "$response" | jq -r '.tenant_id // empty')
        local cmd_count=$(echo "$response" | jq -r '.commands | length')
        
        log "Check-in successful. EPC: $epc_id, Commands: $cmd_count"
        
        # Cache tenant_id for SNMP discovery script
        if [ -n "$tenant_id" ] && [ "$tenant_id" != "null" ]; then
            echo "$tenant_id" > /tmp/epc-tenant-id 2>/dev/null || true
        fi
        
        # Update check-in interval if provided
        local new_interval=$(echo "$response" | jq -r '.checkin_interval // empty')
        if [ -n "$new_interval" ] && [ "$new_interval" != "null" ]; then
            CHECKIN_INTERVAL=$new_interval
        fi
        
        # Check for configuration changes
        local received_config=$(echo "$response" | jq -c '.config // {}')
        local stored_config_file="/etc/wisptools/last-config.json"
        
        if [ -n "$received_config" ] && [ "$received_config" != "null" ] && [ "$received_config" != "{}" ]; then
            local config_changed=false
            local stored_config="{}"
            
            if [ -f "$stored_config_file" ]; then
                stored_config=$(cat "$stored_config_file" 2>/dev/null || echo "{}")
            fi
            
            # Compare configs (simple string comparison for now)
            local received_hash=$(echo "$received_config" | md5sum | awk '{print $1}')
            local stored_hash=$(echo "$stored_config" | md5sum | awk '{print $1}')
            
            if [ "$received_hash" != "$stored_hash" ]; then
                config_changed=true
                log "Configuration changed detected - updating stored configuration"
                
                # Store new config
                echo "$received_config" > "$stored_config_file" 2>/dev/null || true
                
                # Log config details
                local site_name=$(echo "$received_config" | jq -r '.site_name // "unknown"')
                log "New site_name: $site_name"
            fi
        fi
        
        # Run SNMP discovery every 4 hours (separate from regular check-in)
        # Best practice: Network topology doesn't change frequently, hourly is too frequent
        # Prefer Node.js version, fallback to bash script
        local last_discovery_file="/tmp/last-snmp-discovery"
        local discovery_interval=${SNMP_DISCOVERY_INTERVAL:-300}  # Default 5 minutes (300 seconds) - User requested more frequent sweeps
        local should_discover=true
        if [ -f "$last_discovery_file" ]; then
            local last_discovery=$(cat "$last_discovery_file" 2>/dev/null || echo "0")
            local now=$(date +%s)
            local elapsed=$((now - last_discovery))
            if [ $elapsed -lt $discovery_interval ]; then
                should_discover=false
            fi
        fi
        
        if [ "$should_discover" = true ]; then
            log "Starting SNMP discovery in background..."
            
            # Ensure device code and tenant ID are available for discovery script
            local device_code=$(get_device_code)
            local tenant_id_cache="/tmp/epc-tenant-id"
            if [ -n "$device_code" ] && [ ! -f "$tenant_id_cache" ]; then
                # Cache device code in discovery-friendly location
                mkdir -p /etc/wisptools
                echo "$device_code" > /etc/wisptools/device_code 2>/dev/null || true
            fi
            
            # Try Node.js version first, fallback to bash script
            if command -v node >/dev/null 2>&1 && [ -f /opt/wisptools/epc-snmp-discovery.js ]; then
                log "Launching Node.js SNMP discovery script..."
                # Run in background but capture PID to check later
                node /opt/wisptools/epc-snmp-discovery.js >> "$LOG_FILE" 2>&1 &
                local discovery_pid=$!
                log "SNMP discovery started (PID: $discovery_pid)"
            elif [ -f /opt/wisptools/epc-snmp-discovery.sh ]; then
                log "Launching bash SNMP discovery script..."
                /opt/wisptools/epc-snmp-discovery.sh >> "$LOG_FILE" 2>&1 &
                local discovery_pid=$!
                log "SNMP discovery started (PID: $discovery_pid)"
            else
                log "WARNING: SNMP discovery script not found"
            fi
            
            # Set timestamp AFTER launching discovery (not before completion)
            echo "$(date +%s)" > "$last_discovery_file"
        fi
        
        # Note: Ping monitoring now runs BEFORE check-in (synchronously) - see do_checkin() function
        
        # Execute commands
        if [ "$cmd_count" -gt 0 ]; then
            log "Processing $cmd_count command(s) from check-in response"
            echo "$response" | jq -c '.commands[]' | while read -r cmd; do
                local cmd_id=$(echo "$cmd" | jq -r '.id')
                local cmd_type=$(echo "$cmd" | jq -r '.type')
                local action=$(echo "$cmd" | jq -r '.action // empty')
                local target_services=$(echo "$cmd" | jq -r '.target_services | join(" ") // "all"')
                local script_content=$(echo "$cmd" | jq -r '.script_content // empty')
                local script_url=$(echo "$cmd" | jq -r '.script_url // empty')
                
                # Validate command ID
                if [ -z "$cmd_id" ] || [ "$cmd_id" = "null" ]; then
                    log "ERROR: Invalid command ID in response, skipping command"
                    continue
                fi
                
                # For config_update, pass the full command JSON so we can extract config_data properly
                local cmd_json_file="/tmp/wisptools-cmd-$cmd_id.json"
                echo "$cmd" > "$cmd_json_file"
                
                # Log command details for debugging
                log "Executing command - ID: $cmd_id, Type: $cmd_type, Action: ${action:-N/A}, Has config_data: $(echo "$cmd" | jq -r 'if .config_data then "yes" else "no" end')"
                
                # Execute command and ensure result is reported
                if execute_command "$cmd_id" "$cmd_type" "$action" "$target_services" "$script_content" "$script_url" "$cmd_json_file"; then
                    log "Command $cmd_id execution completed successfully"
                else
                    log "ERROR: Command $cmd_id execution failed or result reporting failed"
                fi
            done
            log "Finished processing all commands from check-in"
        fi
        
    elif [ "$status" = "unregistered" ]; then
        log "Device not registered. Enter code $device_code in the management portal."
    else
        # Extract error message from response if available
        local error_msg=$(echo "$response" | jq -r '.error // .message // "Unknown error"' 2>/dev/null || echo "Unknown error")
        log "ERROR: Check-in failed (HTTP $http_code) - $error_msg"
        log "Full response: $(echo "$response" | head -c 500)"
        return 1
    fi
}

# Install the agent
install_agent() {
    echo "======================================"
    echo "Installing WISPTools Check-in Agent"
    echo "======================================"
    
    # Create directories
    mkdir -p /opt/wisptools
    mkdir -p "$CONFIG_DIR"
    
    # Install git if not present
    if ! command -v git >/dev/null 2>&1; then
        echo "Installing git..."
        apt-get update -qq >/dev/null 2>&1
        apt-get install -y git >/dev/null 2>&1 || {
            echo "ERROR: Failed to install git"
            exit 1
        }
        echo "Git installed successfully"
    fi
    
    # Set up git repository for scripts
    echo "Setting up git repository..."
    if [ ! -d "$GIT_REPO_DIR" ]; then
        mkdir -p "$GIT_REPO_DIR"
        git clone --depth 1 --branch "$GIT_REPO_BRANCH" "$GIT_REPO_URL" "$GIT_REPO_DIR" 2>/dev/null || {
            echo "WARNING: Could not clone repository, will use download method"
            GIT_REPO_DIR=""
        }
    else
        cd "$GIT_REPO_DIR"
        git fetch origin "$GIT_REPO_BRANCH" 2>/dev/null || true
        git reset --hard "origin/${GIT_REPO_BRANCH}" 2>/dev/null || true
    fi
    
    # Download the script (handles piped install) - fallback if git fails
    if [ -z "$GIT_REPO_DIR" ] || [ ! -f "${SCRIPTS_SOURCE_DIR}/epc-checkin-agent.sh" ]; then
        echo "Downloading check-in agent from server..."
        curl -fsSL --max-time 60 --connect-timeout 10 "https://${CENTRAL_SERVER}/downloads/scripts/epc-checkin-agent.sh" -o /opt/wisptools/epc-checkin-agent.sh
        if [ $? -ne 0 ]; then
            echo "ERROR: Failed to download check-in agent script"
            exit 1
        fi
    else
        echo "Copying check-in agent from git repository..."
        cp "${SCRIPTS_SOURCE_DIR}/epc-checkin-agent.sh" /opt/wisptools/epc-checkin-agent.sh
    fi
    chmod +x /opt/wisptools/epc-checkin-agent.sh
    
    # Install/update scripts from git repository or download
    echo "Installing agent scripts..."
    
    if [ -n "$GIT_REPO_DIR" ] && [ -d "$SCRIPTS_SOURCE_DIR" ]; then
        # Copy scripts from git repository
        echo "Copying scripts from git repository..."
        [ -f "${SCRIPTS_SOURCE_DIR}/epc-snmp-discovery.js" ] && cp "${SCRIPTS_SOURCE_DIR}/epc-snmp-discovery.js" /opt/wisptools/ && chmod +x /opt/wisptools/epc-snmp-discovery.js && echo "Node.js SNMP discovery script installed"
        [ -f "${SCRIPTS_SOURCE_DIR}/epc-snmp-discovery.sh" ] && cp "${SCRIPTS_SOURCE_DIR}/epc-snmp-discovery.sh" /opt/wisptools/ && chmod +x /opt/wisptools/epc-snmp-discovery.sh && echo "Bash SNMP discovery script installed"
        [ -f "${SCRIPTS_SOURCE_DIR}/epc-ping-monitor.js" ] && cp "${SCRIPTS_SOURCE_DIR}/epc-ping-monitor.js" /opt/wisptools/ && chmod +x /opt/wisptools/epc-ping-monitor.js && echo "Ping monitoring script installed"
    else
        # Fallback to download method
        echo "Downloading scripts from server..."
        # Node.js version
        curl -fsSL "https://${CENTRAL_SERVER}/downloads/scripts/epc-snmp-discovery.js" -o /opt/wisptools/epc-snmp-discovery.js 2>/dev/null || true
        if [ -f /opt/wisptools/epc-snmp-discovery.js ]; then
            chmod +x /opt/wisptools/epc-snmp-discovery.js
            echo "Node.js SNMP discovery script downloaded"
        fi
        
        # Bash version (fallback)
        curl -fsSL "https://${CENTRAL_SERVER}/downloads/scripts/epc-snmp-discovery.sh" -o /opt/wisptools/epc-snmp-discovery.sh 2>/dev/null || true
        if [ -f /opt/wisptools/epc-snmp-discovery.sh ]; then
            chmod +x /opt/wisptools/epc-snmp-discovery.sh 2>/dev/null || true
            echo "Bash SNMP discovery script downloaded (fallback)"
        fi
        
        # Download ping monitoring script
        curl -fsSL "https://${CENTRAL_SERVER}/downloads/scripts/epc-ping-monitor.js" -o /opt/wisptools/epc-ping-monitor.js 2>/dev/null || true
        if [ -f /opt/wisptools/epc-ping-monitor.js ]; then
            chmod +x /opt/wisptools/epc-ping-monitor.js
            echo "Ping monitoring script downloaded"
        fi
    fi
    
    # Install npm packages if Node.js is available
    if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 && [ -f /opt/wisptools/epc-snmp-discovery.js ]; then
        echo "Installing npm packages for SNMP discovery..."
        cd /opt/wisptools
        npm init -y >/dev/null 2>&1 || true
        # Only install net-snmp - use native ping command (no npm package needed)
        npm install --no-save net-snmp >/dev/null 2>&1 || echo "Warning: Failed to install net-snmp, SNMP discovery may use system commands"
    fi
    
    # Create systemd service with robust restart configuration
    cat > /etc/systemd/system/wisptools-checkin.service << 'SVCEOF'
[Unit]
Description=WISPTools EPC Check-in Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/opt/wisptools/epc-checkin-agent.sh daemon
Restart=always
RestartSec=30
StartLimitInterval=300
StartLimitBurst=5

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=wisptools-checkin

# Resource limits and timeouts
TimeoutStartSec=60
TimeoutStopSec=30

# Keep running even if service fails repeatedly
StartLimitAction=none

[Install]
WantedBy=multi-user.target
SVCEOF
    
    systemctl daemon-reload
    systemctl enable wisptools-checkin
    systemctl start wisptools-checkin
    
    echo ""
    echo "Agent installed and started!"
    echo "Check status: systemctl status wisptools-checkin"
    echo "View logs: tail -f $LOG_FILE"
}

# Daemon mode - continuous check-in loop with error recovery
daemon_mode() {
    log "Starting check-in daemon (interval: ${CHECKIN_INTERVAL}s)"
    
    local consecutive_failures=0
    local max_consecutive_failures=10
    local failure_backoff=60  # Start with 60 second backoff on failures
    
    while true; do
        # Run check-in with error handling
        if do_checkin; then
            # Success - reset failure counter and use normal interval
            consecutive_failures=0
            failure_backoff=60
            sleep "$CHECKIN_INTERVAL"
        else
            # Failure - increment counter and use exponential backoff
            consecutive_failures=$((consecutive_failures + 1))
            log "Check-in failed (consecutive failures: $consecutive_failures/$max_consecutive_failures)"
            
            # Exponential backoff: 60s, 120s, 240s, 480s, max 600s
            local backoff_time=$((failure_backoff * (2 ** (consecutive_failures - 1))))
            if [ $backoff_time -gt 600 ]; then
                backoff_time=600  # Cap at 10 minutes
            fi
            
            # If too many consecutive failures, log warning but keep trying
            if [ $consecutive_failures -ge $max_consecutive_failures ]; then
                log "WARNING: $consecutive_failures consecutive check-in failures - using extended backoff (${backoff_time}s)"
                log "Daemon will continue retrying - check network connectivity and backend status"
            else
                log "Retrying in ${backoff_time}s (backoff due to failure)"
            fi
            
            sleep "$backoff_time"
        fi
        
        # Safety check - if we've been running for a very long time without success, log it
        # But don't exit - keep trying
        if [ $consecutive_failures -gt 50 ]; then
            log "CRITICAL: Over 50 consecutive failures - check-in may be completely broken"
            log "Daemon will continue running - please investigate backend connectivity"
            consecutive_failures=0  # Reset counter to prevent log spam
        fi
        
        # Health check - log daemon is still alive periodically
        # Log every 10 failures or every 10 successful check-ins (whichever comes first)
        local health_check_interval=10
        if [ $((consecutive_failures % $health_check_interval)) -eq 0 ] && [ $consecutive_failures -gt 0 ]; then
            log "HEALTH: Daemon is running (consecutive failures: $consecutive_failures) - will continue retrying"
        fi
    done
}

# Main
case "$1" in
    install)
        install_agent
        ;;
    daemon)
        daemon_mode
        ;;
    once)
        do_checkin
        ;;
    *)
        # Default: run once
        do_checkin
        ;;
esac

