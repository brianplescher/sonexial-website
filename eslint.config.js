module.exports = [
    {
        files: ['*.js', 'scripts/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                document: 'readonly',
                window: 'readonly',
                URLSearchParams: 'readonly',
                IntersectionObserver: 'readonly',
                setTimeout: 'readonly',
                gtag: 'readonly',
                console: 'readonly',
                require: 'readonly',
                __dirname: 'readonly',
                process: 'readonly',
                module: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-undef': 'error'
        }
    }
];
