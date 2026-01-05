module.exports = {export default {





















}  },    'react/prop-types': 'off',    ],      { allowConstantExport: true },      'warn',    'react-refresh/only-export-components': [  rules: {  plugins: ['react-refresh'],  settings: { react: { version: '18.2' } },  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },  ignorePatterns: ['dist', '.eslintrc.cjs'],  ],    'plugin:react-hooks/recommended',    'plugin:react/jsx-runtime',    'plugin:react/recommended',    'eslint:recommended',  extends: [  env: { browser: true, es2020: true },  root: true,  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
