export type CopyParams = {
    sourcePath: string;
    targetPath: string;
};

export interface IAppConfig {
    targetPath?: string;
    strategies?: TokenReplacementStrategy[];
}

// ts-command-line-args_write-markdown_copyCodeBelow
export type TokenReplacementStrategy = (
    tokenName: string, // Given {DATE} will be DATE
    tokenArgs: string[] | undefined, // Given {DATE someFormat, someOtherArg} will be ['someFormat', 'someOtherArg']
    token: string, // Given {DATE} will be {DATE}
    targetPath: string, // entire target path e.g. C:/fileSump/{TOKEN_ONE}/{TOKEN_TWO}
    sourcePath: string // source folder we are copying from
) => string | Promise<string | undefined> | undefined; // if token cannot be handled by strategy return undefined
// ts-command-line-args_write-markdown_copyCodeAbove
