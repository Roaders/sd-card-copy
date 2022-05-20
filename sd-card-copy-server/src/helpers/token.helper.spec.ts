/* eslint-disable no-useless-escape */
import { TokenReplacementStrategy } from '../contracts';
import { applyTokenReplacementsStrategies, getTokenParts, replaceTokens } from './token.helper';
import { IMocked, Mock, setupFunction } from '@morgan-stanley/ts-mocking-bird';

type StrategyOwner = {
    one: TokenReplacementStrategy;
    two: TokenReplacementStrategy;
    three: TokenReplacementStrategy;
    four: TokenReplacementStrategy;
};

type StrategyTest = {
    description: string;
    input: string;
    expected: string;
    expectedStrategies?: (keyof StrategyOwner)[];
    setup?: (owner: IMocked<StrategyOwner>) => void;
    validation?: (owner: IMocked<StrategyOwner>) => void;
};

describe(`token helper`, () => {
    describe(`applyTokenReplacementsStrategies`, () => {
        let mockStrategyOwner: IMocked<StrategyOwner>;

        beforeEach(() => {
            mockStrategyOwner = Mock.create<StrategyOwner>().setup(
                setupFunction('one'),
                setupFunction('two'),
                setupFunction('three'),
                setupFunction('four')
            );
        });

        const tests: StrategyTest[] = [
            {
                description: 'call all strategies when none return a result',
                input: `pre {TOKEN} post`,
                expected: `pre {TOKEN} post`,
                expectedStrategies: ['one', 'two', 'three', 'four'],
            },
            {
                description: 'not call any more strategies when when returns a result',
                input: `pre {TOKEN} post`,
                expected: `pre REPLACED_TWO post`,
                expectedStrategies: ['one', 'two'],
                setup: (owner) => owner.setupFunction('two', () => 'REPLACED_TWO'),
            },
            {
                description: 'use the first strategy that returns a result',
                input: `pre {TOKEN} post`,
                expected: `pre REPLACED_ONE post`,
                expectedStrategies: ['one'],
                setup: (owner) =>
                    owner.setup(
                        setupFunction('one', () => 'REPLACED_ONE'),
                        setupFunction('two', () => 'REPLACED_TWO'),
                        setupFunction('three', () => 'REPLACED_THREE'),
                        setupFunction('four', () => 'REPLACED_FOUR')
                    ),
            },
            {
                description: 'pass token arguments',
                input: `pre {TOKEN one two three} post`,
                expected: `pre REPLACED_TWO post`,
                setup: (owner) => owner.setupFunction('two', () => 'REPLACED_TWO'),
                validation: (owner) =>
                    expect(
                        owner
                            .withFunction('two')
                            .withParametersEqualTo(
                                'TOKEN',
                                ['one', 'two', 'three'],
                                '{TOKEN one two three}',
                                'pre {TOKEN one two three} post'
                            )
                    ).wasCalledOnce(),
            },
            {
                description: 'replace different tokens with different strategies',
                input: `pre {TOKEN_ONE} middle {TOKEN_TWO} post`,
                expected: `pre REPLACED_ONE middle REPLACED_TWO post`,
                setup: (owner) =>
                    owner.setup(
                        setupFunction('one', (token) => (token === 'TOKEN_ONE' ? 'REPLACED_ONE' : undefined)),
                        setupFunction('two', (token) => (token === 'TOKEN_TWO' ? 'REPLACED_TWO' : undefined))
                    ),
            },
        ];

        tests.forEach(
            ({ description: name, input, expected, expectedStrategies: expectedFunctions, setup, validation }) => {
                it(`should ${name}`, () => {
                    if (setup != null) {
                        setup(mockStrategyOwner);
                    }
                    const result = applyTokenReplacementsStrategies(input, [
                        mockStrategyOwner.mock.one,
                        mockStrategyOwner.mock.two,
                        mockStrategyOwner.mock.three,
                        mockStrategyOwner.mock.four,
                    ]);

                    expect(result).toEqual(expected);

                    if (expectedFunctions != null) {
                        expectedFunctions.forEach((functionName) => {
                            expect(
                                mockStrategyOwner
                                    .withFunction(functionName)
                                    .withParametersEqualTo('TOKEN', undefined, '{TOKEN}', input)
                            ).wasCalledOnce();
                        });
                    }
                    if (validation != null) {
                        validation(mockStrategyOwner);
                    }
                });
            }
        );
    });

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

    describe(`getTokenParts`, () => {
        const tests = [
            { token: `{}`, expectedName: undefined },
            { token: `{DATE}`, expectedName: 'DATE' },
            { token: `{DATE DD_MM_YYY}`, expectedName: 'DATE', expectedArgs: ['DD_MM_YYY'] },
            { token: `{DATE     DD_MM_YYY}`, expectedName: 'DATE', expectedArgs: ['DD_MM_YYY'] },
            { token: `{DATE     arg1 arg2    arg3}`, expectedName: 'DATE', expectedArgs: ['arg1', 'arg2', 'arg3'] },
            { token: `{DATE  "DDD DD MMM YYY"  arg2}`, expectedName: 'DATE', expectedArgs: ['DDD DD MMM YYY', 'arg2'] },
            {
                token: `{ESCAPED_DATE  "DDD \\"DD\\" MMM YYY"  arg2}`,
                expectedName: 'ESCAPED_DATE',
                expectedArgs: ['DDD \\"DD\\" MMM YYY', 'arg2'],
            },
        ];

        tests.forEach(({ token, expectedName, expectedArgs }) => {
            it(`should return ${JSON.stringify({ expectedName, expectedArgs })} for token '${token}'`, () => {
                const result = getTokenParts(token);

                if (expectedName == null) {
                    expect(result).toBeUndefined();
                } else {
                    expect(result).toBeDefined();
                    expect(result.tokenName).toBe(expectedName);
                    expect(result.tokenArgs).toEqual(expectedArgs);
                }
            });
        });
    });
});
