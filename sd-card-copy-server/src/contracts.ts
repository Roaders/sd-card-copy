export type CopyParams = {
    sourcePath: string;
    targetPath: string;
    deleteSource: boolean;
};

/**
 * Token for a folder name unique to the camera, answered by each camera strategy that recognises the card
 */
export const CAMERA_NAME_TOKEN = 'CAMERA_NAME';

export interface IAppConfig {
    targetPath?: string;
    allowedSourcePaths?: string[];
    strategies?: TokenReplacementStrategy[];
    afterCopy?: AfterCopyAction[];
    excludeFiles?: string[]; // glob patterns matched against file names (e.g. 'LRV_*.lrv'): matching files are not copied, but are still deleted with delete-source
}

/**
 * Called after each copy request has finished: copied (and deleted), failed or refused (e.g. unresolved tokens).
 * getActiveSourcePaths returns the source paths of the copies running at the time it is called.
 */
export type AfterCopyAction = (params: CopyParams, getActiveSourcePaths: () => string[]) => void | Promise<void>;

// ts-command-line-args_write-markdown_copyCodeBelow
export type TokenReplacementStrategy = (
    tokenName: string, // Given {DATE} will be DATE
    tokenArgs: string[] | undefined, // Given {DATE someFormat, someOtherArg} will be ['someFormat', 'someOtherArg']
    token: string, // Given {DATE} will be {DATE}
    targetPath: string, // entire target path e.g. C:/fileSump/{TOKEN_ONE}/{TOKEN_TWO}
    sourcePath: string // source folder we are copying from
) => string | Promise<string | undefined> | undefined; // if token cannot be handled by strategy return undefined
// ts-command-line-args_write-markdown_copyCodeAbove
