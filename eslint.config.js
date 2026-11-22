const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettierRecommended = require('eslint-plugin-prettier/recommended');
const globals = require('globals');

module.exports = tseslint.config(
    { ignores: ['dist/', 'coverage/'] },
    js.configs.recommended,
    tseslint.configs.recommended,
    prettierRecommended,
    {
        languageOptions: {
            globals: { ...globals.browser, ...globals.node },
        },
        rules: {
            'prettier/prettier': [
                'error',
                { tabWidth: 4, singleQuote: true, printWidth: 120, endOfLine: 'auto', trailingComma: 'es5' },
            ],
        },
    },
    {
        files: ['**/*.js'],
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
        },
    }
);
