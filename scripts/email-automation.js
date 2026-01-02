#!/usr/bin/env node

/**
 * Email Automation Script
 * Handles automated email responses for form submissions
 * 
 * This script can be triggered by:
 * - Netlify Functions
 * - Zapier webhook
 * - GitHub Actions
 * - Cron job
 */

const EMAIL_TEMPLATES = {
    leadMagnet: {
        subject: 'Your Free Author Signal Checklist',
        body: `
Hi there!

Thanks for downloading the 10-Point Author Signal Checklist.

You can access your free PDF here:
[DOWNLOAD LINK]

This checklist will help you identify the gaps in your book's metadata before you spend another dollar on ads.

Quick wins you can implement today:
• Optimize your 7 backend keyword strings
• Ensure your BISAC categories are accurate
• Format your description with HTML for better readability

Need help implementing these changes? Our Metadata & Amazon Optimization Kit ($29) includes:
- Strategic Market Analysis
- HTML-Ready Description
- 7 Backend Keyword Strings (Tested)
- 3 BISAC Categories
- Human-Verified Review

Get optimized: https://sonexial.gumroad.com/l/optimize

Best,
Brian Plescher
Founder, Sonexial Labs

P.S. Reply to this email if you have any questions. I read every message.
        `
    },
    
    contactForm: {
        subject: 'Thanks for reaching out to Sonexial Labs',
        body: `
Hi [NAME],

Thanks for contacting Sonexial Labs. I've received your message and will get back to you within 24 hours.

In the meantime, here are some resources that might help:

📚 Free Resources:
- Author Signal Checklist (PDF)
- Blog: Book Marketing in the AI Era
- Case Study: 30% Increase in Also-Boughts

💼 Our Services:
- Metadata Kit ($29): https://sonexial.gumroad.com/l/optimize
- Done-for-You Description Overhaul ($149)
- Strategic Retainer (Limited Availability)

I look forward to helping you optimize your book's discoverability.

Best,
Brian Plescher
Founder, Sonexial Labs
Grand Haven, MI

---
Your message:
[MESSAGE]
        `
    },
    
    purchaseConfirmation: {
        subject: 'Welcome to Sonexial Labs - Next Steps',
        body: `
Hi [NAME],

Welcome to Sonexial Labs! 🎉

Your Metadata & Amazon Optimization Kit purchase is confirmed.

NEXT STEPS:
1. Fill out the intake form: [FORM LINK]
2. We'll analyze your book and market
3. Receive your optimized kit within 48 hours

What you'll receive:
✓ Strategic Market Analysis (3-Sentence Positioning)
✓ HTML-Ready Description (Formatted for Amazon)
✓ 7 Backend Keyword Strings (Tested)
✓ 3 BISAC Categories
✓ Human-Verified Review

INTAKE FORM:
Please complete this 10-minute form so we can get started:
[FORM LINK]

The more detail you provide, the better we can optimize your metadata.

Questions? Just reply to this email.

Best,
Brian Plescher
Founder, Sonexial Labs

P.S. Check your spam folder if you don't see our follow-up emails.
        `
    },
    
    deliveryEmail: {
        subject: 'Your Sonexial Labs Kit is Ready! 📦',
        body: `
Hi [NAME],

Your Metadata & Amazon Optimization Kit is complete and ready for implementation!

📦 DOWNLOAD YOUR KIT:
[DOWNLOAD LINK]

Your kit includes:
1. Strategic_Market_Analysis.pdf
2. HTML_Description.txt (ready to copy-paste)
3. Backend_Keywords.txt (7 optimized strings)
4. BISAC_Categories.txt (3 recommended categories)
5. Implementation_Guide.pdf

IMPLEMENTATION STEPS:
1. Log into your KDP account
2. Go to your book's detail page
3. Copy-paste the HTML description
4. Add the 7 backend keyword strings
5. Update your BISAC categories
6. Save and publish

IMPORTANT: Test your changes on a preview before publishing.

Need help with implementation? Reply to this email and I'll walk you through it.

WHAT'S NEXT:
- Monitor your Also-Boughts for 2-3 weeks
- Track your keyword rankings
- Watch for improved discoverability

I'd love to hear your results! Reply in a few weeks and let me know how it's working.

Best,
Brian Plescher
Founder, Sonexial Labs

P.S. If you found this valuable, I'd appreciate a testimonial or referral!
        `
    },
    
    followUp7Days: {
        subject: 'How are your metadata changes working?',
        body: `
Hi [NAME],

It's been a week since you received your Metadata Kit. I wanted to check in and see how the implementation went.

Quick questions:
• Did you implement the changes?
• Are you seeing any improvements in discoverability?
• Do you have any questions about the optimization?

COMMON QUESTIONS:
Q: How long until I see results?
A: Most authors see changes in Also-Boughts within 2-3 weeks.

Q: Should I update my ads?
A: Yes! Use the new keywords in your Amazon Ads campaigns.

Q: Can I use this for multiple books?
A: Each book needs its own optimization, but the process is the same.

NEED MORE HELP?
If you're launching a new book or want a complete description overhaul, check out our Done-for-You service ($149):
[LINK]

Reply to this email if you have any questions. I'm here to help!

Best,
Brian Plescher
Founder, Sonexial Labs
        `
    },
    
    abandonedCart: {
        subject: 'Still thinking about optimizing your book?',
        body: `
Hi there,

I noticed you were interested in the Metadata & Amazon Optimization Kit but didn't complete your purchase.

I get it - you want to make sure it's the right investment.

Here's what makes our kit different:
• Human-verified (not just AI-generated)
• Tested keywords (not guesses)
• 48-hour turnaround
• 100% money-back guarantee

REAL RESULTS:
"I saw a 30% increase in Also-Boughts after implementing the metadata changes. It's the best money I've spent on my author career." - Sarah J.

LIMITED TIME: Use code OPTIMIZE10 for $10 off (expires in 48 hours)

Get your kit: https://sonexial.gumroad.com/l/optimize

Questions? Just reply to this email.

Best,
Brian Plescher
Founder, Sonexial Labs

P.S. Not ready yet? Download our free checklist to see what you're missing: [LINK]
        `
    }
};

// Function to send email (integrate with your email service)
function sendEmail(to, template, variables = {}) {
    const emailTemplate = EMAIL_TEMPLATES[template];
    
    if (!emailTemplate) {
        console.error(`Template not found: ${template}`);
        return false;
    }
    
    let subject = emailTemplate.subject;
    let body = emailTemplate.body;
    
    // Replace variables
    Object.keys(variables).forEach(key => {
        const placeholder = `[${key.toUpperCase()}]`;
        subject = subject.replace(placeholder, variables[key]);
        body = body.replace(new RegExp(placeholder, 'g'), variables[key]);
    });
    
    console.log('📧 Sending email:');
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Template: ${template}`);
    
    // TODO: Integrate with your email service
    // Examples:
    // - SendGrid
    // - Mailgun
    // - AWS SES
    // - Postmark
    
    return true;
}

// Export for use in other scripts
module.exports = {
    EMAIL_TEMPLATES,
    sendEmail
};

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('Usage: node email-automation.js <email> <template> [variables]');
        console.log('\nAvailable templates:');
        Object.keys(EMAIL_TEMPLATES).forEach(template => {
            console.log(`  - ${template}`);
        });
        process.exit(1);
    }
    
    const [email, template, ...variableArgs] = args;
    const variables = {};
    
    // Parse variables (format: key=value)
    variableArgs.forEach(arg => {
        const [key, value] = arg.split('=');
        if (key && value) {
            variables[key] = value;
        }
    });
    
    sendEmail(email, template, variables);
}
