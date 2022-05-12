const tokenStart = '{';
const tokenEnd = '}';
const escapeCharacter = '\\';

export function replaceTokens(tokenString: string, replacer: (token: string) => string): string {
    const segments: string[] = [];

    let tokenIndex = 0;
    let count = 0;

    while (tokenIndex >= 0) {
        count++;

        const nextStartToken = tokenString.indexOf(tokenStart, tokenIndex);
        const escapedStart = tokenString.charAt(nextStartToken - 1) === escapeCharacter;

        let nextEndToken = nextStartToken;
        let escapedEnd = escapedStart;
        let endCount = 0;

        while (nextStartToken >= 0 && nextEndToken >= 0 && (nextEndToken === nextStartToken || escapedEnd)) {
            endCount++;

            if (endCount > tokenString.length) {
                console.error(
                    `ERROR: infinite loop detected when looking for end token given string: '${tokenString}'`
                );
                break;
            }

            nextEndToken = tokenString.indexOf(tokenEnd, nextEndToken + (escapedEnd ? 1 : 0));
            escapedEnd = tokenString.charAt(nextEndToken - 1) === escapeCharacter;
        }

        if (count > tokenString.length) {
            console.error(`ERROR: infinite loop detected when looking for tokens in string: '${tokenString}'`);
            break;
        }

        if (escapedStart) {
            segments.push(tokenString.substring(tokenIndex, nextStartToken + 1));
            tokenIndex = nextStartToken + 1;
        } else if (nextStartToken < 0 || nextEndToken < 0) {
            segments.push(tokenString.substring(tokenIndex));
            break;
        } else {
            segments.push(tokenString.substring(tokenIndex, nextStartToken));
            const tokenEnd = nextEndToken + 1;
            const token = tokenString.substring(nextStartToken, tokenEnd);
            segments.push(replacer(token));
            tokenIndex = tokenEnd;
        }
    }

    return segments.join('');
}
