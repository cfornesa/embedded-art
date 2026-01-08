<?php
/**
 * app/lib/config.example.php
 *
 * Configuration file for database and SMTP credentials.
 *
 * INSTRUCTIONS FOR HOSTINGER:
 * 1. Copy this file to config.php in the same directory
 * 2. Fill in your actual credentials below
 * 3. Keep config.php private - never commit it to git!
 *
 * This file is used for:
 * - Database connection (MySQL on Hostinger)
 * - SMTP email sending (optional, mail() works by default on Hostinger)
 */

return [
  // ===================================
  // DATABASE CONFIGURATION (REQUIRED)
  // ===================================

  // Force MySQL (recommended for Hostinger)
  "DB_DRIVER" => "mysql",

  // MySQL connection details from Hostinger cPanel
  "DB_HOST" => "localhost",  // Usually "localhost" on shared hosting
  "DB_NAME" => "your_database_name",  // From Hostinger MySQL Databases
  "DB_USER" => "your_database_user",  // From Hostinger MySQL Databases
  "DB_PASS" => "your_database_password",  // From Hostinger MySQL Databases


  // ===================================
  // SMTP CONFIGURATION (OPTIONAL)
  // ===================================

  // SMTP is OPTIONAL on Hostinger - PHP's mail() function works by default.
  // Only configure SMTP if you want to use an external email service.

  // Option 1: Use Hostinger's mail() (default) - NO SMTP CONFIG NEEDED
  // Just leave the SMTP_* fields commented out or empty

  // Option 2: Use external SMTP (Gmail, SendGrid, etc.)
  // Uncomment and fill in these fields:

  // "SMTP_HOST" => "smtp.gmail.com",  // SMTP server hostname
  // "SMTP_PORT" => 587,  // 587 for TLS, 465 for SSL
  // "SMTP_USER" => "your-email@gmail.com",  // SMTP username
  // "SMTP_PASS" => "your-app-password",  // SMTP password (use app password for Gmail)
];
