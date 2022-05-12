import { replaceTokens } from './token.helper';

describe(`token helper`, () => {
    describe(`tokenStringSplit`, () => {
        const tests = [
            { input: 'noTokens', expected: 'noTokens', expectedTokens: [] },
            { input: 'pre {TOKEN post', expected: 'pre {TOKEN post', expectedTokens: [] },
            { input: 'pre TOKEN} post', expected: 'pre TOKEN} post', expectedTokens: [] },
            { input: 'pre {TOKEN} post', expected: 'pre REPLACED post', expectedTokens: ['{TOKEN}'] },
            {
                input: 'pre {TOKEN ONE} middle {TOKEN TWO} post',
                expected: 'pre REPLACED middle REPLACED post',
                expectedTokens: ['{TOKEN ONE}', '{TOKEN TWO}'],
            },
            {
                input: 'pre {TOKEN ONE}{TOKEN TWO} post',
                expected: 'pre REPLACEDREPLACED post',
                expectedTokens: ['{TOKEN ONE}', '{TOKEN TWO}'],
            },
            {
                input: 'pre {TOKEN with content} post',
                expected: 'pre REPLACED post',
                expectedTokens: ['{TOKEN with content}'],
            },
            { input: 'pre {TOKEN}', expected: 'pre REPLACED', expectedTokens: ['{TOKEN}'] },
            { input: '{TOKEN} post', expected: 'REPLACED post', expectedTokens: ['{TOKEN}'] },
            { input: 'pre \\{TOKEN\\} post', expected: 'pre \\{TOKEN\\} post', expectedTokens: [] },
            { input: 'pre \\{TOKEN} post', expected: 'pre \\{TOKEN} post', expectedTokens: [] },
            { input: 'pre {TOKEN\\} post', expected: 'pre {TOKEN\\} post', expectedTokens: [] },
            {
                input: 'pre {ESCAPED \\} TOKEN} post',
                expected: 'pre REPLACED post',
                expectedTokens: ['{ESCAPED \\} TOKEN}'],
            },
        ];

        tests.forEach(({ input, expected, expectedTokens }) => {
            it(`given the string '${input}' it should return ${expected} with tokens: ${JSON.stringify(
                expectedTokens
            )}`, () => {
                const tokens: string[] = [];

                const replaceFunction = (token: string) => {
                    tokens.push(token);
                    return `REPLACED`;
                };

                const result = replaceTokens(input, replaceFunction);
                expect(result).toEqual(expected);
                expect(tokens).toEqual(expectedTokens);
            });
        });
    });
});
