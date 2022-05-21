import { TokenReplacementStrategy } from '../contracts';

/* eslint-disable no-case-declarations */
const tokenStart = '{';
const tokenEnd = '}';
const escapeCharacter = '\\';

export async function applyTokenReplacementsStrategies(
    input: string,
    strategies: TokenReplacementStrategy[]
): Promise<string> {
    return replaceTokens(input, async (token) => {
        const { tokenName, tokenArgs } = getTokenParts(token);

        for (let index = 0; index < strategies.length; index++) {
            const result = await strategies[index](tokenName, tokenArgs, token, input);

            if (result != null) {
                return result;
            }
        }

        return token;
    });
}

export async function replaceTokens(
    tokenString: string,
    replacer: (token: string) => string | Promise<string>
): Promise<string> {
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
            segments.push(await replacer(token));
            tokenIndex = tokenEnd;
        }
    }

    return segments.join('');
}

// https://regex101.com/r/t8cvrY/1
const tokenRegExp = /\{(\w+) *(.+)?}/;

export function getTokenParts(token: string):
    | {
          tokenName: string;
          tokenArgs?: string[];
      }
    | undefined {
    const matchResult = tokenRegExp.exec(token);

    if (matchResult == null) {
        return undefined;
    }

    const tokenArgs = matchResult[2] != null ? buildArgumentsList(matchResult[2]) : undefined;

    return { tokenName: matchResult[1], tokenArgs };
}

const SPACE = ' ';
const QUOTE = `"`;

function buildArgumentsList(input: string, tokenArguments: string[] = []): string[] {
    if (input === '') {
        return tokenArguments;
    }

    switch (input.charAt(0)) {
        case SPACE:
            return buildArgumentsList(input.substring(1), tokenArguments);
        case QUOTE:
            return popFirstArgument(input, tokenArguments, QUOTE);
        default:
            return popFirstArgument(input, tokenArguments);
    }
}

function popFirstArgument(input: string, tokenArguments: string[] = [], delimiter = SPACE): string[] {
    while (input.charAt(0) === delimiter) {
        input = input.substring(1);
    }

    let argumentEnd = input.indexOf(delimiter);

    while (input.charAt(argumentEnd - 1) === escapeCharacter) {
        argumentEnd = input.indexOf(delimiter, argumentEnd + 1);
    }

    if (argumentEnd >= 0) {
        tokenArguments.push(input.substring(0, argumentEnd));
        return buildArgumentsList(input.substring(argumentEnd + 1), tokenArguments);
    } else {
        tokenArguments.push(input);
        return tokenArguments;
    }
}
