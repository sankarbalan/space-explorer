require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const axios = require('axios');

const app = express();
const PORT = Number(process.env.PORT || 3000);

// ========================================
// MIDDLEWARE
// ========================================

app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Serve frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ========================================
// EMAIL CONFIGURATION
// ========================================

const smtpConfigured = Boolean(
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.OWNER_EMAIL
);

const resendConfigured = Boolean(
    process.env.RESEND_API_KEY &&
    process.env.OWNER_EMAIL
);

const emailConfigured = resendConfigured || smtpConfigured;

const transporter = smtpConfigured && !resendConfigured
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT || 465),
        secure: String(process.env.SMTP_SECURE || 'true') === 'true',

        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    })
    : null;

// ========================================
// HELPER FUNCTIONS
// ========================================

function clean(value, max) {
    return String(value ?? '')
        .trim()
        .slice(0, max);
}

function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ========================================
// HEALTH CHECK
// ========================================

app.get('/api/health', (req, res) => {
    res.json({
        ok: true,
        emailConfigured: Boolean(emailConfigured),
        emailProvider: resendConfigured ? 'resend' : smtpConfigured ? 'smtp' : null,

        googleSearchConfigured: Boolean(
            process.env.GOOGLE_API_KEY &&
            process.env.GOOGLE_CX
        )
    });
});

// ========================================
// CONTACT / ERROR REPORT
// ========================================

app.post('/api/contact', async (req, res) => {
    const name = clean(req.body.name, 80);
    const email = clean(req.body.email, 120);
    const message = clean(req.body.message, 2000);
    const website = clean(req.body.website, 200);

    // ----------------------------------------
    // Honeypot protection
    // ----------------------------------------

    if (website) {
        return res.json({
            ok: true,
            message: 'Thanks — we got it.'
        });
    }

    // ----------------------------------------
    // Validation
    // ----------------------------------------

    if (name.length < 2) {
        return res.status(400).json({
            ok: false,
            message: 'Please enter your name.'
        });
    }

    if (!validEmail(email)) {
        return res.status(400).json({
            ok: false,
            message: 'Please enter a valid email address.'
        });
    }

    if (message.length < 10) {
        return res.status(400).json({
            ok: false,
            message: 'Message must be at least 10 characters.'
        });
    }

    // ----------------------------------------
    // Check email configuration
    // ----------------------------------------

    if (!emailConfigured) {
        return res.status(503).json({
            ok: false,
            message:
                'Email service is not configured yet. Add Resend or SMTP settings.'
        });
    }

    // ----------------------------------------
    // Send email
    // ----------------------------------------

    try {
        const mail = {
            from: `"Space Explorer" <${process.env.SMTP_USER || process.env.OWNER_EMAIL}>`,
            to: process.env.OWNER_EMAIL,
            replyTo: email,
            subject:
                `Space Explorer — ${name} reported an issue / asked a question`,

            // Plain text version
            text: `
Name: ${name}
Email: ${email}

Message:
${message}

Submitted: ${new Date().toISOString()}
            `.trim(),

            // HTML version
            html: `
                <!DOCTYPE html>

                <html>
                <head>
                    <meta charset="UTF-8">

                    <title>Space Explorer Message</title>
                </head>

                <body
                    style="
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #111;
                    "
                >

                    <h2>Space Explorer Message</h2>

                    <p>
                        <strong>Name:</strong>
                        ${escapeHtml(name)}
                    </p>

                    <p>
                        <strong>Email:</strong>
                        ${escapeHtml(email)}
                    </p>

                    <hr>

                    <p>
                        <strong>Message:</strong>
                    </p>

                    <p>
                        ${escapeHtml(message).replace(/\n/g, '<br>')}
                    </p>

                    <hr>

                    <p>
                        <small>
                            Submitted:
                            ${new Date().toISOString()}
                        </small>
                    </p>

                </body>
                </html>
            `
        };

        if (resendConfigured) {
            await axios.post('https://api.resend.com/emails', {
                from: process.env.RESEND_FROM || 'Space Explorer <onboarding@resend.dev>',
                to: [mail.to],
                reply_to: mail.replyTo,
                subject: mail.subject,
                text: mail.text,
                html: mail.html
            }, {
                headers: {
                    Authorization: `Bearer ${process.env.RESEND_API_KEY}`
                }
            });
        } else {
            await transporter.sendMail(mail);
        }

        console.log(`Email sent successfully from ${email}`);

        return res.json({
            ok: true,
            message: 'Thanks — your message was sent to the owner.'
        });

    } catch (error) {
        console.error('Email error:', error);

        return res.status(500).json({
            ok: false,
            message:
                'The message could not be sent right now. Please try again later.'
        });
    }
});

// ========================================
// SEARCH API
// ========================================

app.get('/api/search', async (req, res) => {
    const q = clean(req.query.q, 200);

    // ----------------------------------------
    // Validate search
    // ----------------------------------------

    if (q.length < 2) {
        return res.status(400).json({
            ok: false,
            message: 'Search question is too short.'
        });
    }

    try {

        // ====================================
        // GOOGLE CUSTOM SEARCH
        // ====================================

        if (
            process.env.GOOGLE_API_KEY &&
            process.env.GOOGLE_CX
        ) {
            const google = await axios.get(
                'https://www.googleapis.com/customsearch/v1',
                {
                    params: {
                        key: process.env.GOOGLE_API_KEY,
                        cx: process.env.GOOGLE_CX,
                        q: q,
                        num: 6,
                        safe: 'active'
                    },

                    timeout: 8000
                }
            );

            const results = (google.data.items || []).map(item => ({
                title: item.title,
                url: item.link,
                snippet: item.snippet || '',
                source: item.displayLink || 'Google Search'
            }));

            return res.json({
                ok: true,
                provider: 'google',
                results
            });
        }

        // ====================================
        // WIKIPEDIA FALLBACK
        // ====================================

        const wiki = await axios.get(
            'https://en.wikipedia.org/w/api.php',
            {
                params: {
                    action: 'query',

                    generator: 'search',

                    gsrsearch: q,

                    gsrlimit: 6,

                    prop: 'extracts|info',

                    exintro: 1,

                    explaintext: 1,

                    inprop: 'url',

                    format: 'json',

                    origin: '*'
                },

                timeout: 8000
            }
        );

        const pages = Object.values(
            wiki.data.query?.pages || {}
        );

        const results = pages.map(page => ({
            title: page.title,

            url:
                page.fullurl ||
                `https://en.wikipedia.org/wiki/${encodeURIComponent(
                    page.title.replace(/ /g, '_')
                )}`,

            snippet: page.extract || '',

            source: 'Wikipedia'
        }));

        return res.json({
            ok: true,
            provider: 'wikipedia',
            results
        });

    } catch (error) {

        console.error('Search error:', error.message);

        return res.status(502).json({
            ok: false,
            message:
                'External search is temporarily unavailable.'
        });
    }
});

// ========================================
// FRONTEND FALLBACK
// ========================================

app.get(/.*/, (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            '..',
            'frontend',
            'index.html'
        )
    );
});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {

    console.log('');
    console.log('========================================');
    console.log('      SPACE EXPLORER SERVER');
    console.log('========================================');

    console.log(`Server: http://localhost:${PORT}`);

    console.log(
        `Email: ${emailConfigured ? 'CONFIGURED ✓' : 'NOT CONFIGURED ✗'}`
    );

    console.log(
        `Google Search: ${
            process.env.GOOGLE_API_KEY && process.env.GOOGLE_CX
                ? 'CONFIGURED ✓'
                : 'NOT CONFIGURED'
        }`
    );

    console.log('========================================');
    console.log('');
});