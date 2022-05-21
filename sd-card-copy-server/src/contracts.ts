export type CopyParams = {
    sourcePath: string;
    targetPath: string;
};

export interface IAppConfig {
    targetPath?: string;
    strategies?: TokenReplacementStrategy[];
}

export type TokenReplacementStrategy = (
    tokenName: string,
    tokenArgs: string[] | undefined,
    token: string,
    targetPath: string,
    sourcePath: string
) => string | Promise<string | undefined> | undefined;
