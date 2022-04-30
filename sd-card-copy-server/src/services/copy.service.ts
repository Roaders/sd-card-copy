import { Injectable } from '@nestjs/common';
import { CopyParams } from '../contracts';
import copyProgress, {
    configureFileCopyProgressFunction,
    mapFileStats,
    streamScanPathResults,
    isIFilesProgress,
} from 'copy-progress';
import { filter, last, map } from 'rxjs';
import chalk from 'chalk';

@Injectable()
export class CopyService {
    startCopy(params: CopyParams) {
        const targetPath = params.targetPath || process.env.targetPath;

        console.log(`Copying ${params.sourcePath} -> ${targetPath}`);

        const filesStream = streamScanPathResults(params.sourcePath).pipe(
            map((file) => mapFileStats({ file, outDir: targetPath, sourceDir: params.sourcePath }))
        );

        copyProgress(filesStream, {
            concurrentCopy: 1,
            copyFunction: configureFileCopyProgressFunction({ force: true, highWaterMark: 1024 * 1024 * 1000 }),
        })
            .pipe(filter(isIFilesProgress), last())
            .subscribe({
                next: (lastValue) =>
                    console.log(
                        `Copied ${lastValue.totalFiles} files (${lastValue.totalBytes}b) ${params.sourcePath} -> ${targetPath} in ${lastValue.elapsed}ms`
                    ),
                error: (err) => console.log(`${chalk.red('ERR: ')}`, err),
            });
    }
}
