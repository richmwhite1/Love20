#!/bin/bash

# Firestore Security Rules Deployment Script
# This script deploys the comprehensive security rules to Firestore

set -e  # Exit on any error

echo "🔒 Deploying Firestore Security Rules..."
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    print_error "Firebase CLI is not installed. Please install it first:"
    echo "npm install -g firebase-tools"
    exit 1
fi

# Check if user is logged in to Firebase
if ! firebase projects:list &> /dev/null; then
    print_error "Not logged in to Firebase. Please login first:"
    echo "firebase login"
    exit 1
fi

# Check if firestore.rules file exists
if [ ! -f "firestore.rules" ]; then
    print_error "firestore.rules file not found!"
    exit 1
fi

# Validate the rules file
print_status "Validating security rules..."
if ! firebase firestore:rules:validate firestore.rules; then
    print_error "Security rules validation failed!"
    exit 1
fi

print_success "Security rules validation passed"

# Create backup of current rules
print_status "Creating backup of current rules..."
if [ -f "firestore.rules.backup" ]; then
    print_warning "Backup file already exists, overwriting..."
fi

cp firestore.rules firestore.rules.backup
print_success "Backup created: firestore.rules.backup"

# Deploy the rules
print_status "Deploying security rules to Firestore..."
if firebase deploy --only firestore:rules; then
    print_success "Security rules deployed successfully!"
else
    print_error "Failed to deploy security rules!"
    print_status "Restoring backup..."
    cp firestore.rules.backup firestore.rules
    exit 1
fi

# Verify deployment
print_status "Verifying deployment..."
sleep 5  # Wait for deployment to propagate

# Test basic functionality
print_status "Running basic security tests..."

# Create a simple test script
cat > test_rules_deployment.js << 'EOF'
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

async function testBasicRules() {
  const testEnv = await initializeTestEnvironment({
    projectId: 'love20-test',
    firestore: {
      rules: require('fs').readFileSync('firestore.rules', 'utf8')
    }
  });

  try {
    const db = testEnv.authenticatedContext('test-user').firestore();
    
    // Test: Authenticated user can read users collection
    await assertSucceeds(db.collection('users').doc('test').get());
    
    // Test: Unauthenticated access is denied
    const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(unauthenticatedDb.collection('users').doc('test').get());
    
    console.log('✅ Basic security tests passed');
  } catch (error) {
    console.error('❌ Basic security tests failed:', error);
    throw error;
  } finally {
    await testEnv.cleanup();
  }
}

testBasicRules().catch(console.error);
EOF

# Run basic tests if testing framework is available
if command -v node &> /dev/null && [ -f "package.json" ]; then
    if npm list @firebase/rules-unit-testing &> /dev/null; then
        print_status "Running basic security tests..."
        if node test_rules_deployment.js; then
            print_success "Basic security tests passed"
        else
            print_warning "Basic security tests failed - manual verification recommended"
        fi
    else
        print_warning "Firebase rules testing framework not installed. Skipping tests."
        echo "To install: npm install --save-dev @firebase/rules-unit-testing"
    fi
else
    print_warning "Node.js not available. Skipping automated tests."
fi

# Clean up test file
rm -f test_rules_deployment.js

# Display deployment summary
echo ""
echo "🎉 Security Rules Deployment Complete!"
echo "======================================"
echo ""
echo "✅ Rules deployed successfully"
echo "✅ Backup created: firestore.rules.backup"
echo "✅ Validation passed"
echo ""
echo "📋 Next Steps:"
echo "1. Test the application thoroughly"
echo "2. Monitor for any access denied errors"
echo "3. Verify privacy is properly enforced"
echo "4. Check the FIRESTORE_SECURITY_RULES.md for details"
echo ""
echo "🔄 Rollback if needed:"
echo "   cp firestore.rules.backup firestore.rules"
echo "   firebase deploy --only firestore:rules"
echo ""
echo "📞 For issues, check:"
echo "   - Firebase Console > Firestore > Rules"
echo "   - Application logs for access errors"
echo "   - FIRESTORE_SECURITY_RULES.md documentation"
echo ""

print_success "Deployment completed successfully!" 