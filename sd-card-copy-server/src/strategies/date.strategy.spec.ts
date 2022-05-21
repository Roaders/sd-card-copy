import { IMocked, Mock, setupFunction } from '@morgan-stanley/ts-mocking-bird';
import { TimestampProvider } from '../providers';
import { DateStrategies, DATE_TOKEN, TIMESTAMP_TOKEN } from './date.strategy';

const mockedTimestamp = 1236297600000;

describe(`${DateStrategies.name} (date.strategy)`, () => {
    let mockTimestampProvider: IMocked<TimestampProvider>;

    beforeEach(() => {
        mockTimestampProvider = Mock.create<TimestampProvider>().setup(
            setupFunction('getTimeStamp', () => mockedTimestamp)
        );
    });

    function createInstance() {
        return new DateStrategies(mockTimestampProvider.mock);
    }

    it(`should create`, () => {
        expect(createInstance()).toBeDefined();
    });

    describe(`timestampStrategy`, () => {
        it('should return undefined when token is not correct', () => {
            expect(
                createInstance().timestampStrategy('incorrectToken', [], `{incorrectToken}`, 'target', 'source')
            ).toBeUndefined();
        });

        it('should return a timestamp', () => {
            const result = createInstance().timestampStrategy(TIMESTAMP_TOKEN, [], `{wholeToken}`, 'target', 'source');

            expect(typeof result).toBe('string');
            expect(result).toBe('1236297600000');
        });
    });

    describe(`formattedDateStrategy`, () => {
        it('should return undefined when token is not correct', () => {
            expect(
                createInstance().formattedDateStrategy('incorrectToken', [], `{incorrectToken}`, 'target', 'source')
            ).toBeUndefined();
        });

        it('should return date string', () => {
            const result = createInstance().formattedDateStrategy(DATE_TOKEN, [], `{wholeToken}`, 'target', 'source');

            expect(result).toBe('Fri Mar 06 2009');
        });

        it('should return formatted date when pattern passed', () => {
            const result = createInstance().formattedDateStrategy(
                DATE_TOKEN,
                ['yyyy-MM-dd'],
                `{wholeToken}`,
                'target',
                'source'
            );

            expect(result).toBe('2009-03-06');
        });

        it('should return formatted date when pattern passed', () => {
            const pattern = `'Today is' EEEE 'the' do 'of' LLLL yyyy`;
            const result = createInstance().formattedDateStrategy(
                DATE_TOKEN,
                [pattern],
                `{wholeToken}`,
                'target',
                'source'
            );

            expect(result).toBe('Today is Friday the 6th of March 2009');
        });
    });
});
