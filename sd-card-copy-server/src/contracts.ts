export type CopyParams = {
    sourcePath: string;
    targetPath: string;
};

export interface IAppConfig {
    targetPath?: string;
}

export type TokenReplacementStrategy = (
    tokenName: string,
    tokenArgs: string[] | undefined,
    token: string,
    path: string
) => string | Promise<string | undefined> | undefined;
