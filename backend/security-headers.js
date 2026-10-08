module.exports = {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    "https://cdn.jsdelivr.net",
                    "https://www.gstatic.com",
                    "https://apis.google.com",
                    "https://*.firebaseapp.com",
                    "https://accounts.google.com"
                ],
                scriptSrcAttr: ["'none'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: [
                    "'self'",
                    "https://identitytoolkit.googleapis.com",
                    "https://securetoken.googleapis.com",
                    "https://lumuz-e2f23.firebaseapp.com",
                    "https://*.firebaseapp.com",
                    "https://*.googleapis.com",
                    "https://www.gstatic.com",
                    "https://api.coingecko.com",
                    "https://accounts.google.com",
                    "https://*.firebaseio.com",
                    "wss://*.firebaseio.com"
                ],
                frameSrc: [
                    "'self'",
                    "https://www.youtube-nocookie.com",
                    "https://lumuz-e2f23.firebaseapp.com",
                    "https://*.firebaseapp.com",
                    "https://apis.google.com",
                    "https://accounts.google.com"
                ],
                frameAncestors: ["'none'"]
            }
        },
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: false
    };
