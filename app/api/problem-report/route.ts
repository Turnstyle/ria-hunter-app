import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { z } from 'zod';

const problemReportSchema = z.object({
  message: z.string().min(1, 'Message is required').max(250, 'Message cannot exceed 250 characters'),
  userEmail: z.string().email('Valid email is required'),
  userId: z.string().min(1, 'User ID is required'),
});

// Create reusable transporter object using the default SMTP transport
const createTransporter = () => {
  const user = process.env.GMAIL_USER || process.env.EMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASSWORD;
  if (!user || !pass) {
    return null;
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = problemReportSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          issues: validation.error.issues 
        },
        { status: 400 }
      );
    }

    const { message, userEmail, userId } = validation.data;

    // Try to verify user (best-effort). If service key missing, continue gracefully.
    let adminUser: any = null;
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data, error } = await supabase.auth.admin.getUserById(userId);
        if (!error) adminUser = data;
      }
    } catch (e) {
      // Swallow admin lookup issues; continue
    }

    // Get subscription information if available
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status, created_at')
      .eq('user_id', userId)
      .single();

    // Prepare email content
    const truncatedMessage = message.length > 50 ? `${message.substring(0, 50)}...` : message;
    const subject = `Problem Report: ${userEmail} "${truncatedMessage}"`;

    const emailBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .content { background-color: #ffffff; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; }
        .user-info { background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0; }
        .message-box { background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 15px 0; }
        .meta-info { color: #6c757d; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h2>🚨 Problem Report from RIA Hunter</h2>
        <p>A user has reported an issue with the application.</p>
    </div>
    
    <div class="content">
        <div class="user-info">
            <h3>User Information</h3>
            <ul>
                <li><strong>Email:</strong> ${userEmail}</li>
                <li><strong>User ID:</strong> ${userId}</li>
                <li><strong>User Metadata:</strong> ${JSON.stringify(adminUser?.user?.user_metadata || {}, null, 2)}</li>
                <li><strong>Created At:</strong> ${adminUser?.user?.created_at || 'N/A'}</li>
                <li><strong>Last Sign In:</strong> ${adminUser?.user?.last_sign_in_at || 'N/A'}</li>
                <li><strong>Subscription Status:</strong> ${subscription?.status || 'No subscription'}</li>
                ${subscription ? `<li><strong>Subscription Created:</strong> ${subscription.created_at}</li>` : ''}
            </ul>
        </div>

        <div class="message-box">
            <h3>Problem Description</h3>
            <p><strong>Full Message:</strong></p>
            <blockquote>${message}</blockquote>
        </div>

        <div class="meta-info">
            <p><strong>Report Generated:</strong> ${new Date().toISOString()}</p>
            <p><strong>Message Length:</strong> ${message.length}/250 characters</p>
            <p><strong>User Agent:</strong> ${request.headers.get('user-agent') || 'Not provided'}</p>
            <p><strong>IP Address:</strong> ${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Not available'}</p>
        </div>
    </div>
</body>
</html>
    `.trim();

    // Send email if transporter is configured; otherwise, accept and log.
    const transporter = createTransporter();
    if (!transporter) {
      console.warn('Problem report received but email transport not configured. Returning success to avoid UX failure.');
      console.warn({ message, userEmail, userId });
      return NextResponse.json({ success: true, message: 'Problem report received' }, { status: 200 });
    }

    try {
      const mailOptions = {
        from: process.env.GMAIL_USER || process.env.EMAIL_USER || 'noreply@riahunter.com',
        to: process.env.PROBLEM_REPORT_TO || 'turnerpeters@gmail.com',
        subject: subject,
        html: emailBody,
        text: `
Problem Report from RIA Hunter

User: ${userEmail}
User ID: ${userId}
Subscription: ${subscription?.status || 'No subscription'}

Message:
${message}

Generated: ${new Date().toISOString()}
        `.trim(),
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Problem report email sent:', info.messageId);

      // Optionally, you could also log this to your database for tracking
      // await supabase.from('problem_reports').insert({
      //   user_id: userId,
      //   message: message,
      //   user_email: userEmail,
      //   created_at: new Date().toISOString()
      // });

      return NextResponse.json(
        { 
          success: true, 
          message: 'Problem report submitted successfully' 
        },
        { status: 200 }
      );

    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Do not fail the user experience; accept the report.
      return NextResponse.json({ success: true, message: 'Problem report received' }, { status: 200 });
    }

  } catch (error) {
    console.error('Error processing problem report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}