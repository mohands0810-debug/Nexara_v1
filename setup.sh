#!/usr/bin/env bash
# ═══════════════════════════════════════════════════
#  NEXARA — Auto Setup Script
# ═══════════════════════════════════════════════════

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║     NEXARA EMERGENCY SYSTEM SETUP    ║${NC}"
echo -e "${CYAN}${BOLD}║        Every Second Is Sacred        ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
  echo -e "${RED}✗ Python 3 is required. Install from python.org${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Python $(python3 --version)${NC}"

# Install dependencies
echo -e "\n${CYAN}Installing backend dependencies…${NC}"
cd backend
pip install -r requirements.txt --quiet
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Start server
echo ""
echo -e "${CYAN}${BOLD}Starting NEXARA server…${NC}"
echo -e "  🌐 Open: ${BOLD}http://localhost:8000${NC}"
echo -e "  🚨 SOS:  ${BOLD}http://localhost:8000/patient.html${NC}"
echo -e "  🚑 Driver: ${BOLD}http://localhost:8000/driver.html${NC}"
echo -e "  🛰️  Dispatch: ${BOLD}http://localhost:8000/dispatch.html${NC}"
echo -e "  🔐 Admin: ${BOLD}http://localhost:8000/admin.html${NC}"
echo -e "     Credentials: ${BOLD}nexara_admin / nexara@2025${NC}"
echo ""

uvicorn main:socket_app --host 0.0.0.0 --port 8000 --reload
