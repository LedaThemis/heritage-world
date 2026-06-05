/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_APP_TITLE: string;
    readonly VITE_SERVER_URL: string;
    readonly VITE_IS_OFFLINE_SINGLE_SITE: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
