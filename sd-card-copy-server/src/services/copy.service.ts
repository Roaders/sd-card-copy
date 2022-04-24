import { Injectable } from '@nestjs/common';
import { CopyParams } from '../contracts';
import copyDirectory from 'copydirectory';

@Injectable()
export class CopyService {
    startCopy(params: CopyParams) {
        const targetPath = params.targetPath || process.env.targetPath;

        console.log(`Copying ${params.sourcePath} -> ${targetPath}`);

        copyDirectory(params.sourcePath, params.targetPath, () => {
            console.log(`Copy done`);
        });
    }
}
