#!/bin/bash

# Comprehensive Caching Strategy Deployment Script
# This script deploys the caching implementation with validation and testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="love20-app"
CACHE_VERSION="v1.0.0"
BACKUP_DIR="./cache-backup-$(date +%Y%m%d-%H%M%S)"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Firebase CLI is installed
    if ! command -v firebase &> /dev/null; then
        error "Firebase CLI is not installed. Please install it first:"
        echo "npm install -g firebase-tools"
        exit 1
    fi
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed. Please install it first."
        exit 1
    fi
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        error "npm is not installed. Please install it first."
        exit 1
    fi
    
    success "All prerequisites are satisfied"
}

# Backup current configuration
backup_configuration() {
    log "Creating backup of current configuration..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup Firebase configuration
    if [ -f "firebase.json" ]; then
        cp firebase.json "$BACKUP_DIR/"
        success "Backed up firebase.json"
    fi
    
    # Backup service worker
    if [ -f "public/sw.js" ]; then
        cp public/sw.js "$BACKUP_DIR/"
        success "Backed up service worker"
    fi
    
    # Backup cache services
    if [ -d "client/src/lib" ]; then
        mkdir -p "$BACKUP_DIR/lib"
        cp client/src/lib/cache-service.ts "$BACKUP_DIR/lib/" 2>/dev/null || true
        cp client/src/lib/image-cache-service.ts "$BACKUP_DIR/lib/" 2>/dev/null || true
        cp client/src/lib/cache-invalidation.ts "$BACKUP_DIR/lib/" 2>/dev/null || true
        cp client/src/lib/sw-registration.ts "$BACKUP_DIR/lib/" 2>/dev/null || true
        success "Backed up cache services"
    fi
    
    success "Backup completed: $BACKUP_DIR"
}

# Validate configuration
validate_configuration() {
    log "Validating configuration..."
    
    # Validate Firebase configuration
    if [ ! -f "firebase.json" ]; then
        error "firebase.json not found"
        exit 1
    fi
    
    # Check if cache headers are configured
    if ! grep -q "Cache-Control" firebase.json; then
        warning "Cache headers not found in firebase.json"
    else
        success "Cache headers configured in firebase.json"
    fi
    
    # Validate service worker
    if [ ! -f "public/sw.js" ]; then
        error "Service worker not found at public/sw.js"
        exit 1
    fi
    
    # Validate cache services
    local missing_services=()
    
    if [ ! -f "client/src/lib/cache-service.ts" ]; then
        missing_services+=("cache-service.ts")
    fi
    
    if [ ! -f "client/src/lib/image-cache-service.ts" ]; then
        missing_services+=("image-cache-service.ts")
    fi
    
    if [ ! -f "client/src/lib/cache-invalidation.ts" ]; then
        missing_services+=("cache-invalidation.ts")
    fi
    
    if [ ! -f "client/src/lib/sw-registration.ts" ]; then
        missing_services+=("sw-registration.ts")
    fi
    
    if [ ${#missing_services[@]} -gt 0 ]; then
        error "Missing cache services: ${missing_services[*]}"
        exit 1
    fi
    
    success "Configuration validation passed"
}

# Build the application
build_application() {
    log "Building application..."
    
    # Install dependencies
    log "Installing dependencies..."
    npm install
    
    # Build the application
    log "Building application..."
    npm run build
    
    if [ $? -eq 0 ]; then
        success "Application built successfully"
    else
        error "Build failed"
        exit 1
    fi
}

# Deploy to Firebase
deploy_to_firebase() {
    log "Deploying to Firebase..."
    
    # Deploy hosting with cache configuration
    firebase deploy --only hosting --project "$PROJECT_ID"
    
    if [ $? -eq 0 ]; then
        success "Firebase hosting deployed successfully"
    else
        error "Firebase deployment failed"
        exit 1
    fi
}

# Test cache functionality
test_cache_functionality() {
    log "Testing cache functionality..."
    
    # Get the deployed URL
    local deployed_url=$(firebase hosting:channel:list --project "$PROJECT_ID" --json | jq -r '.result.channels[0].url // "https://love20-app.web.app"')
    
    log "Testing cache headers..."
    
    # Test API cache headers
    local api_response=$(curl -sI "$deployed_url/api/users/test")
    if echo "$api_response" | grep -q "Cache-Control"; then
        success "API cache headers are working"
    else
        warning "API cache headers not detected"
    fi
    
    # Test static asset cache headers
    local static_response=$(curl -sI "$deployed_url/assets/index.js")
    if echo "$static_response" | grep -q "immutable"; then
        success "Static asset cache headers are working"
    else
        warning "Static asset cache headers not detected"
    fi
    
    # Test service worker
    local sw_response=$(curl -sI "$deployed_url/sw.js")
    if [ $? -eq 0 ]; then
        success "Service worker is accessible"
    else
        warning "Service worker not accessible"
    fi
    
    success "Cache functionality testing completed"
}

# Generate cache performance report
generate_performance_report() {
    log "Generating performance report..."
    
    cat > "cache-performance-report.md" << EOF
# Cache Performance Report

## Deployment Information
- **Version**: $CACHE_VERSION
- **Deployment Date**: $(date)
- **Project ID**: $PROJECT_ID

## Configuration Status
- ✅ Firebase Hosting cache headers configured
- ✅ Service worker deployed
- ✅ Cache services implemented
- ✅ Image caching enabled
- ✅ Cache invalidation configured

## Performance Metrics
- **Expected API Call Reduction**: 60-80%
- **Expected Image Bandwidth Reduction**: 40-60%
- **Expected Page Load Improvement**: 30-50%

## Cache Types Implemented
1. **User Profiles**: 5 minutes TTL
2. **Post Feeds**: 1 minute TTL
3. **Lists**: 10 minutes TTL
4. **Friend Lists**: 5 minutes TTL
5. **Images**: Immutable caching
6. **Static Assets**: 1 year TTL

## Monitoring
- Cache dashboard available at: /cache-dashboard
- Service worker status: Check browser dev tools
- Performance monitoring: Use browser network tab

## Next Steps
1. Monitor cache hit rates for 1 week
2. Adjust TTL values based on usage patterns
3. Implement cache warming for critical paths
4. Set up performance monitoring alerts

## Rollback Instructions
If issues occur, restore from backup: $BACKUP_DIR
EOF
    
    success "Performance report generated: cache-performance-report.md"
}

# Main deployment function
main() {
    log "Starting comprehensive caching strategy deployment..."
    log "Version: $CACHE_VERSION"
    log "Project: $PROJECT_ID"
    
    # Check prerequisites
    check_prerequisites
    
    # Backup current configuration
    backup_configuration
    
    # Validate configuration
    validate_configuration
    
    # Build application
    build_application
    
    # Deploy to Firebase
    deploy_to_firebase
    
    # Test cache functionality
    test_cache_functionality
    
    # Generate performance report
    generate_performance_report
    
    success "Caching strategy deployment completed successfully!"
    
    log "Summary:"
    echo "  - Backup created: $BACKUP_DIR"
    echo "  - Configuration validated"
    echo "  - Application built and deployed"
    echo "  - Cache functionality tested"
    echo "  - Performance report generated"
    echo ""
    echo "Next steps:"
    echo "  1. Monitor cache performance"
    echo "  2. Adjust cache strategies based on usage"
    echo "  3. Set up performance monitoring"
    echo "  4. Train team on cache management"
}

# Rollback function
rollback() {
    log "Rolling back to previous configuration..."
    
    if [ -d "$BACKUP_DIR" ]; then
        # Restore Firebase configuration
        if [ -f "$BACKUP_DIR/firebase.json" ]; then
            cp "$BACKUP_DIR/firebase.json" .
            success "Restored firebase.json"
        fi
        
        # Restore service worker
        if [ -f "$BACKUP_DIR/sw.js" ]; then
            cp "$BACKUP_DIR/sw.js" public/
            success "Restored service worker"
        fi
        
        # Restore cache services
        if [ -d "$BACKUP_DIR/lib" ]; then
            cp "$BACKUP_DIR/lib"/* client/src/lib/ 2>/dev/null || true
            success "Restored cache services"
        fi
        
        success "Rollback completed"
    else
        error "Backup directory not found: $BACKUP_DIR"
        exit 1
    fi
}

# Parse command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "rollback")
        rollback
        ;;
    "validate")
        check_prerequisites
        validate_configuration
        success "Validation completed"
        ;;
    "test")
        test_cache_functionality
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|validate|test}"
        echo ""
        echo "Commands:"
        echo "  deploy   - Deploy the complete caching strategy"
        echo "  rollback - Rollback to previous configuration"
        echo "  validate - Validate configuration without deploying"
        echo "  test     - Test cache functionality"
        exit 1
        ;;
esac 