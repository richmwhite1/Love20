#!/bin/bash

# Instagram-Scale Feed System Deployment Script
# This script deploys the complete feed system with validation and rollback capabilities

set -e

# Configuration
PROJECT_ID="love20-app"
REGION="us-central1"
FUNCTIONS_DIR="functions"
CLIENT_DIR="client"
SERVER_DIR="server"
BACKUP_DIR="backups/feed-system-$(date +%Y%m%d-%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    log_info "Checking dependencies..."
    
    local missing_deps=()
    
    if ! command -v firebase &> /dev/null; then
        missing_deps+=("firebase")
    fi
    
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    fi
    
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    fi
    
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_error "Please install the missing dependencies and try again."
        exit 1
    fi
    
    log_success "All dependencies are installed"
}

# Create backup
create_backup() {
    log_info "Creating backup..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup current Firestore rules
    if [ -f "firestore.rules" ]; then
        cp firestore.rules "$BACKUP_DIR/"
    fi
    
    # Backup current indexes
    if [ -f "firestore.indexes.json" ]; then
        cp firestore.indexes.json "$BACKUP_DIR/"
    fi
    
    # Backup current functions
    if [ -d "$FUNCTIONS_DIR" ]; then
        cp -r "$FUNCTIONS_DIR" "$BACKUP_DIR/"
    fi
    
    # Backup current server code
    if [ -d "$SERVER_DIR" ]; then
        cp -r "$SERVER_DIR" "$BACKUP_DIR/"
    fi
    
    # Backup current client code
    if [ -d "$CLIENT_DIR" ]; then
        cp -r "$CLIENT_DIR" "$BACKUP_DIR/"
    fi
    
    log_success "Backup created at $BACKUP_DIR"
}

# Validate feed schema
validate_feed_schema() {
    log_info "Validating feed schema..."
    
    if [ ! -f "shared/feed-schema.ts" ]; then
        log_error "Feed schema file not found"
        exit 1
    fi
    
    # Check for required enums and types
    if ! grep -q "FeedTypeEnum" "shared/feed-schema.ts"; then
        log_error "FeedTypeEnum not found in schema"
        exit 1
    fi
    
    if ! grep -q "JobTypeEnum" "shared/feed-schema.ts"; then
        log_error "JobTypeEnum not found in schema"
        exit 1
    fi
    
    log_success "Feed schema validation passed"
}

# Validate feed service
validate_feed_service() {
    log_info "Validating feed service..."
    
    if [ ! -f "server/services/feed-service.ts" ]; then
        log_error "Feed service file not found"
        exit 1
    fi
    
    # Check for required methods
    local required_methods=("getFeed" "generateFeedForUser" "getUserFeedPreferences" "createFeedGenerationJob")
    
    for method in "${required_methods[@]}"; do
        if ! grep -q "async $method" "server/services/feed-service.ts"; then
            log_error "Required method $method not found in feed service"
            exit 1
        fi
    done
    
    log_success "Feed service validation passed"
}

# Validate Cloud Functions
validate_cloud_functions() {
    log_info "Validating Cloud Functions..."
    
    if [ ! -f "functions/src/feed-functions.ts" ]; then
        log_error "Feed functions file not found"
        exit 1
    fi
    
    # Check for required functions
    local required_functions=("onPostCreated" "onPostUpdated" "onFriendshipChanged" "processFeedJobs")
    
    for func in "${required_functions[@]}"; do
        if ! grep -q "export const $func" "functions/src/feed-functions.ts"; then
            log_error "Required function $func not found in Cloud Functions"
            exit 1
        fi
    done
    
    log_success "Cloud Functions validation passed"
}

# Validate API routes
validate_api_routes() {
    log_info "Validating API routes..."
    
    if [ ! -f "server/routes.ts" ]; then
        log_error "Routes file not found"
        exit 1
    fi
    
    # Check for required endpoints
    local required_endpoints=("/api/feed/" "/api/feed/preferences" "/api/feed/generate")
    
    for endpoint in "${required_endpoints[@]}"; do
        if ! grep -q "$endpoint" "server/routes.ts"; then
            log_error "Required endpoint $endpoint not found in routes"
            exit 1
        fi
    done
    
    log_success "API routes validation passed"
}

# Validate frontend components
validate_frontend() {
    log_info "Validating frontend components..."
    
    if [ ! -f "client/src/hooks/queries/useFeed.ts" ]; then
        log_error "Feed hooks file not found"
        exit 1
    fi
    
    if [ ! -f "client/src/components/features/feed/Feed.tsx" ]; then
        log_error "Feed component file not found"
        exit 1
    fi
    
    # Check for required hooks
    local required_hooks=("useInfiniteFeed" "useFeed" "useFeedPreferences")
    
    for hook in "${required_hooks[@]}"; do
        if ! grep -q "export const $hook" "client/src/hooks/queries/useFeed.ts"; then
            log_error "Required hook $hook not found"
            exit 1
        fi
    done
    
    log_success "Frontend components validation passed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    # Install server dependencies
    if [ -f "package.json" ]; then
        npm install
    fi
    
    # Install functions dependencies
    if [ -d "$FUNCTIONS_DIR" ] && [ -f "$FUNCTIONS_DIR/package.json" ]; then
        cd "$FUNCTIONS_DIR"
        npm install
        cd ..
    fi
    
    # Install client dependencies
    if [ -d "$CLIENT_DIR" ] && [ -f "$CLIENT_DIR/package.json" ]; then
        cd "$CLIENT_DIR"
        npm install
        cd ..
    fi
    
    log_success "Dependencies installed"
}

# Build client
build_client() {
    log_info "Building client..."
    
    if [ -d "$CLIENT_DIR" ]; then
        cd "$CLIENT_DIR"
        npm run build
        cd ..
        log_success "Client built successfully"
    else
        log_warning "Client directory not found, skipping build"
    fi
}

# Deploy Firestore rules and indexes
deploy_firestore() {
    log_info "Deploying Firestore rules and indexes..."
    
    # Deploy rules
    if [ -f "firestore.rules" ]; then
        firebase deploy --only firestore:rules
    fi
    
    # Deploy indexes
    if [ -f "firestore.indexes.json" ]; then
        firebase deploy --only firestore:indexes
    fi
    
    log_success "Firestore rules and indexes deployed"
}

# Deploy Cloud Functions
deploy_functions() {
    log_info "Deploying Cloud Functions..."
    
    if [ -d "$FUNCTIONS_DIR" ]; then
        firebase deploy --only functions
        log_success "Cloud Functions deployed"
    else
        log_warning "Functions directory not found, skipping deployment"
    fi
}

# Deploy hosting
deploy_hosting() {
    log_info "Deploying hosting..."
    
    firebase deploy --only hosting
    log_success "Hosting deployed"
}

# Test feed system
test_feed_system() {
    log_info "Testing feed system..."
    
    # Wait for deployment to complete
    sleep 30
    
    # Test API endpoints
    local base_url="https://$PROJECT_ID.web.app"
    
    # Test feed preferences endpoint (should return 401 without auth)
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$base_url/api/feed/preferences")
    if [ "$response" != "401" ]; then
        log_warning "Feed preferences endpoint returned $response (expected 401)"
    fi
    
    # Test feed endpoint (should return 401 without auth)
    response=$(curl -s -o /dev/null -w "%{http_code}" "$base_url/api/feed/chronological")
    if [ "$response" != "401" ]; then
        log_warning "Feed endpoint returned $response (expected 401)"
    fi
    
    log_success "Feed system tests completed"
}

# Monitor deployment
monitor_deployment() {
    log_info "Monitoring deployment..."
    
    # Check Cloud Functions status
    if [ -d "$FUNCTIONS_DIR" ]; then
        log_info "Checking Cloud Functions status..."
        firebase functions:list
    fi
    
    # Check Firestore indexes
    log_info "Checking Firestore indexes..."
    firebase firestore:indexes
    
    log_success "Deployment monitoring completed"
}

# Rollback function
rollback() {
    log_warning "Rolling back deployment..."
    
    if [ -d "$BACKUP_DIR" ]; then
        # Restore Firestore rules
        if [ -f "$BACKUP_DIR/firestore.rules" ]; then
            cp "$BACKUP_DIR/firestore.rules" .
            firebase deploy --only firestore:rules
        fi
        
        # Restore indexes
        if [ -f "$BACKUP_DIR/firestore.indexes.json" ]; then
            cp "$BACKUP_DIR/firestore.indexes.json" .
            firebase deploy --only firestore:indexes
        fi
        
        # Restore functions
        if [ -d "$BACKUP_DIR/functions" ]; then
            cp -r "$BACKUP_DIR/functions" .
            firebase deploy --only functions
        fi
        
        log_success "Rollback completed"
    else
        log_error "Backup directory not found, cannot rollback"
    fi
}

# Main deployment function
main() {
    log_info "Starting Instagram-Scale Feed System deployment..."
    
    # Check if we're in the right directory
    if [ ! -f "firebase.json" ]; then
        log_error "firebase.json not found. Please run this script from the project root."
        exit 1
    fi
    
    # Check dependencies
    check_dependencies
    
    # Create backup
    create_backup
    
    # Validate components
    validate_feed_schema
    validate_feed_service
    validate_cloud_functions
    validate_api_routes
    validate_frontend
    
    # Install dependencies
    install_dependencies
    
    # Build client
    build_client
    
    # Deploy components
    deploy_firestore
    deploy_functions
    deploy_hosting
    
    # Test and monitor
    test_feed_system
    monitor_deployment
    
    log_success "Instagram-Scale Feed System deployment completed successfully!"
    log_info "Backup location: $BACKUP_DIR"
    log_info "Project URL: https://$PROJECT_ID.web.app"
}

# Handle errors and rollback
trap 'log_error "Deployment failed. Rolling back..."; rollback; exit 1' ERR

# Parse command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "rollback")
        rollback
        ;;
    "validate")
        check_dependencies
        validate_feed_schema
        validate_feed_service
        validate_cloud_functions
        validate_api_routes
        validate_frontend
        log_success "All validations passed!"
        ;;
    "test")
        test_feed_system
        ;;
    "monitor")
        monitor_deployment
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|validate|test|monitor}"
        echo "  deploy   - Deploy the complete feed system (default)"
        echo "  rollback - Rollback to previous version"
        echo "  validate - Validate all components without deploying"
        echo "  test     - Test the deployed feed system"
        echo "  monitor  - Monitor deployment status"
        exit 1
        ;;
esac 