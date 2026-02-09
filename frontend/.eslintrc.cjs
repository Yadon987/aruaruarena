module.exports = {
    root: true,
    env: { browser: true, es2020: true, node: true },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react/recommended',
        'plugin:react-hooks/recommended',
        'plugin:jsx-a11y/recommended',
        'plugin:import/recommended',
        'plugin:import/typescript',
        'prettier', // 必ず最後に配置（他の設定を上書き防止）
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
            jsx: true,
        },
    },
    // plugins配列はextendsで設定を適用するのみの場合は省略可能
    // prettier/prettierルールを使用するためprettierのみ残す
    plugins: ['prettier'],
    rules: {
        'react/react-in-jsx-scope': 'off',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        'import/order': ['error', { alphabetize: { order: 'asc' } }],
        'import/no-unresolved': 'off', // TypeScriptが型チェックを行うため無効化
        'import/no-cycle': 'error',     // 循環参照をエラーにする
        'prettier/prettier': 'error',
    },
    settings: {
        react: {
            version: 'detect',
        },
        'import/resolver': {
            typescript: {
                alwaysTryTypes: true,
                project: './tsconfig.json',
            },
        },
    },
    ignorePatterns: [
        'vite.config.ts',
        'vitest.config.ts',
        '*.config.ts',
        'dist',
        'node_modules',
    ],
};
