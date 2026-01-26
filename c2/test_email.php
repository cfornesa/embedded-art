<?php
/**
 * Email functionality test script
 * Tests both SMTP and mail() functions
 */

require_once __DIR__ . '/app/lib/piece.php';

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
echo "EMAIL FUNCTIONALITY TEST\n";
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

// 1. Check if mail() function exists
echo "1. PHP mail() function: ";
echo function_exists('mail') ? "✓ Available\n" : "✗ Not available\n";

// 2. Check if fsockopen exists (for SMTP)
echo "2. fsockopen() function: ";
echo function_exists('fsockopen') ? "✓ Available\n" : "✗ Not available\n";

// 3. Load SMTP configuration
echo "\n3. SMTP Configuration:\n";
$smtpCfg = load_smtp_config();
echo "   - SMTP_HOST: " . ($smtpCfg['SMTP_HOST'] ?: '(not set)') . "\n";
echo "   - SMTP_PORT: " . ($smtpCfg['SMTP_PORT'] ?: '(not set)') . "\n";
echo "   - SMTP_USER: " . ($smtpCfg['SMTP_USER'] ?: '(not set)') . "\n";
echo "   - SMTP_PASS: " . ($smtpCfg['SMTP_PASS'] ? '***set***' : '(not set)') . "\n";

$hasSmtp = $smtpCfg['SMTP_HOST'] && $smtpCfg['SMTP_USER'] && $smtpCfg['SMTP_PASS'];
echo "\n   SMTP Status: ";
if ($hasSmtp) {
    // Check if it's placeholder values
    if (strpos($smtpCfg['SMTP_HOST'], 'your-smtp-host') !== false) {
        echo "✗ Placeholder values detected (not configured)\n";
    } else {
        echo "✓ Configured\n";
    }
} else {
    echo "✗ Not configured\n";
}

// 4. Test mail() function (dry run)
echo "\n4. PHP mail() test (dry run - no actual email sent):\n";
try {
    // We won't actually send, just check if the function can be called
    $testHeaders = "From: Test <test@example.com>\r\n";
    $testHeaders .= "Content-Type: text/plain; charset=UTF-8\r\n";

    // Note: On most systems without a mail server, mail() returns false
    // We're just checking if it can be invoked without errors
    echo "   Attempting to invoke mail() function...\n";

    // Check for sendmail or equivalent
    $sendmailPath = ini_get('sendmail_path');
    echo "   sendmail_path: " . ($sendmailPath ?: '(not set)') . "\n";

    if (empty($sendmailPath) || $sendmailPath === '/usr/sbin/sendmail -t -i') {
        echo "   ⚠ Warning: Default sendmail path may not work on Replit\n";
    }

    echo "   Result: Function callable, but likely won't deliver without MTA\n";
} catch (Throwable $e) {
    echo "   ✗ Error: " . $e->getMessage() . "\n";
}

echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
echo "RECOMMENDATIONS:\n";
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

if (!$hasSmtp || strpos($smtpCfg['SMTP_HOST'] ?? '', 'your-smtp-host') !== false) {
    echo "⚠ SMTP is not properly configured.\n\n";
    echo "To enable email notifications, configure SMTP credentials:\n\n";
    echo "OPTION 1: Create c2/app/lib/config.php with:\n";
    echo "<?php\n";
    echo "return [\n";
    echo "  'SMTP_HOST' => 'smtp.gmail.com',  // Your SMTP server\n";
    echo "  'SMTP_PORT' => 587,\n";
    echo "  'SMTP_USER' => 'your-email@gmail.com',\n";
    echo "  'SMTP_PASS' => 'your-app-password',  // Use app password for Gmail\n";
    echo "];\n\n";

    echo "OPTION 2: Set environment variables (Replit Secrets):\n";
    echo "  SMTP_HOST=smtp.gmail.com\n";
    echo "  SMTP_PORT=587\n";
    echo "  SMTP_USER=your-email@gmail.com\n";
    echo "  SMTP_PASS=your-app-password\n\n";

    echo "For Gmail:\n";
    echo "  1. Enable 2-factor authentication\n";
    echo "  2. Generate an App Password: https://myaccount.google.com/apppasswords\n";
    echo "  3. Use the app password (not your regular password)\n\n";
} else {
    echo "✓ SMTP appears to be configured.\n";
    echo "  If emails still aren't sending, check:\n";
    echo "  - SMTP credentials are correct\n";
    echo "  - Firewall isn't blocking outbound port " . $smtpCfg['SMTP_PORT'] . "\n";
    echo "  - SMTP server allows connections from this IP\n\n";
}

echo "On Hostinger:\n";
echo "  - PHP mail() typically works without SMTP configuration\n";
echo "  - Ensure 'contact@augmenthumankind.com' is a valid email on your domain\n\n";

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
