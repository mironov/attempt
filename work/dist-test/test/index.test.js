"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = require("ava");
const src_1 = require("../src");
function almostEqual(a, b, tolerance) {
    return Math.abs(a - b) <= tolerance;
}
const DELAY_TOLERANCE = parseInt(process.env.DELAY_TOLERANCE || '', 10) || 100;
ava_1.default('should be able to calculate delays', t => {
    const options = {
        delay: 0,
        initialDelay: 0,
        minDelay: 0,
        maxDelay: 0,
        factor: 0,
        maxAttempts: 0,
        timeout: 0,
        totalTimeout: 0,
        jitter: false,
        handleError: null,
        handleTimeout: null,
        handleTotalTimeout: null,
        beforeAttempt: null,
        calculateDelay: null
    };
    const context = {
        attemptNum: 0,
        attemptsRemaining: 0,
        aborted: false,
        abort() {
            // do nothing
        }
    };
    for (const attempt of [{ num: 1, delay: 200, factor: 0, expected: 200 }, { num: 2, delay: 200, factor: 0, expected: 200 }, { num: 3, delay: 200, factor: 0, expected: 200 },
    //
    { num: 1, delay: 200, factor: 2, expected: 200 }, { num: 2, delay: 200, factor: 2, expected: 400 }, { num: 3, delay: 200, factor: 2, expected: 800 },
    //
    { num: 1, delay: 200, factor: 1.5, expected: 200 }, { num: 2, delay: 200, factor: 1.5, expected: 300 }, { num: 3, delay: 200, factor: 1.5, expected: 450 },
    //
    { num: 1, delay: 0, factor: 15 /* ignored because delay is 0 */, expected: 0 }, { num: 2, delay: 0, factor: 15 /* ignored because delay is 0 */, expected: 0 }, { num: 3, delay: 0, factor: 15 /* ignored because delay is 0 */, expected: 0 },
    //
    { num: 1, delay: 200, maxDelay: 300, factor: 2, expected: 200 }, { num: 2, delay: 200, maxDelay: 300, factor: 2, expected: 300 }, { num: 3, delay: 200, maxDelay: 300, factor: 2, expected: 300 }]) {
        context.attemptNum = attempt.num;
        options.delay = attempt.delay;
        options.factor = attempt.factor;
        options.maxDelay = attempt.maxDelay || 0;
        const delay = src_1.defaultCalculateDelay(context, options);
        t.is(delay, attempt.expected, JSON.stringify(attempt));
    }
});
ava_1.default('should default to 3 attempts with 200 delay', async t => {
    let expectedDelays = [0, 200, 200];
    let lastTime = Date.now();
    let attemptCount = 0;
    const err = await t.throws(src_1.retry(async (context, options) => {
        let newTime = Date.now();
        let actualDelay = newTime - lastTime;
        lastTime = newTime;
        t.deepEqual(options, {
            delay: 200,
            initialDelay: 0,
            minDelay: 0,
            maxDelay: 0,
            factor: 0,
            maxAttempts: 3,
            timeout: 0,
            totalTimeout: 0,
            jitter: false,
            handleError: null,
            handleTimeout: null,
            handleTotalTimeout: null,
            beforeAttempt: null,
            calculateDelay: null
        });
        attemptCount++;
        t.true(almostEqual(actualDelay, expectedDelays[context.attemptNum], DELAY_TOLERANCE));
        throw new Error(`attempt ${context.attemptNum}`);
    }));
    t.is(attemptCount, 3);
    t.is(err.message, 'attempt 2');
});
ava_1.default('should support initialDelay', async t => {
    let expectedDelays = [100, 300, 300];
    let lastTime = Date.now();
    let attemptCount = 0;
    const err = await t.throws(src_1.retry(async context => {
        attemptCount++;
        let newTime = Date.now();
        let actualDelay = newTime - lastTime;
        lastTime = newTime;
        t.true(almostEqual(actualDelay, expectedDelays[context.attemptNum], DELAY_TOLERANCE));
        throw new Error(`attempt ${context.attemptNum}`);
    }, {
        initialDelay: 100,
        maxAttempts: 3,
        delay: 300
    }));
    t.is(attemptCount, 3);
    t.is(err.message, 'attempt 2');
});
ava_1.default('should stop trying once maxAttempts is reached', async t => {
    const maxAttempts = 5;
    let attemptCount = 0;
    const err = await t.throws(src_1.retry(async context => {
        t.is(context.attemptNum, attemptCount);
        attemptCount++;
        throw new Error('FAILED');
    }, {
        maxAttempts,
        delay: 0
    }));
    t.is(err.message, 'FAILED');
    t.is(attemptCount, maxAttempts);
});
ava_1.default('should support timeout on first attempt', async t => {
    const err = await t.throws(src_1.retry(async () => {
        await src_1.sleep(500);
    }, {
        delay: 0,
        timeout: 50,
        maxAttempts: 3
    }));
    t.is(err.code, 'ATTEMPT_TIMEOUT');
});
ava_1.default('should support timeout and handleTimeout', async t => {
    async function fallback() {
        await src_1.sleep(100);
        return 'used fallback';
    }
    const result = await src_1.retry(async () => {
        await src_1.sleep(500);
        return 'did not use fallback';
    }, {
        delay: 0,
        timeout: 50,
        maxAttempts: 2,
        handleTimeout: fallback
    });
    t.is(result, 'used fallback');
});
ava_1.default('should allow handleTimeout to throw an error', async t => {
    const err = await t.throws(src_1.retry(async () => {
        await src_1.sleep(500);
    }, {
        delay: 0,
        timeout: 50,
        maxAttempts: 2,
        handleTimeout: async context => {
            throw new Error('timeout occurred');
        }
    }));
    t.is(err.message, 'timeout occurred');
});
ava_1.default('should support timeout for multiple attempts', async t => {
    let attemptCount = 0;
    const err = await t.throws(src_1.retry(async context => {
        attemptCount++;
        if (context.attemptNum === 2) {
            return src_1.sleep(500);
        } else {
            throw new Error('fake error');
        }
    }, {
        delay: 0,
        timeout: 50,
        maxAttempts: 5
    }));
    // third attempt should timeout
    t.is(attemptCount, 3);
    t.is(err.code, 'ATTEMPT_TIMEOUT');
});
ava_1.default('should support totalTimeout on first attempt', async t => {
    const err = await t.throws(src_1.retry(async () => {
        await src_1.sleep(500);
    }, {
        delay: 0,
        totalTimeout: 50,
        maxAttempts: 3
    }));
    t.is(err.code, 'TOTAL_TIMEOUT');
});
ava_1.default('should support totalTimeout and handleTotalTimeout', async t => {
    async function fallback() {
        await src_1.sleep(100);
        return 'used fallback';
    }
    const result = await src_1.retry(async () => {
        await src_1.sleep(500);
        return 'did not use fallback';
    }, {
        delay: 0,
        totalTimeout: 50,
        maxAttempts: 2,
        handleTotalTimeout: fallback
    });
    t.is(result, 'used fallback');
});
ava_1.default('should allow handleTotalTimeout to throw an error', async t => {
    const err = await t.throws(src_1.retry(async () => {
        await src_1.sleep(500);
    }, {
        delay: 0,
        totalTimeout: 50,
        maxAttempts: 2,
        handleTotalTimeout: async context => {
            throw new Error('timeout occurred');
        }
    }));
    t.is(err.message, 'timeout occurred');
});
ava_1.default('should support totalTimeout that happens between attempts', async t => {
    let attemptCount = 0;
    const err = await t.throws(src_1.retry(async context => {
        attemptCount++;
        if (context.attemptNum > 2) {
            return 'did not timeout';
        } else {
            await src_1.sleep(20);
            throw new Error('fake error');
        }
    }, {
        delay: 0,
        totalTimeout: 50,
        maxAttempts: 5
    }));
    // third attempt should timeout
    t.is(attemptCount, 3);
    t.is(err.code, 'TOTAL_TIMEOUT');
});
ava_1.default('should support retries', async t => {
    const resultMessage = 'hello';
    const result = await src_1.retry(async context => {
        if (context.attemptsRemaining === 0) {
            return resultMessage;
        } else {
            throw new Error('not done');
        }
    }, {
        delay: 0,
        maxAttempts: 5
    });
    t.is(result, resultMessage);
});
ava_1.default('should not exceed maximum retries', async t => {
    const err = await t.throws(src_1.retry(async context => {
        if (context.attemptNum !== 5) {
            throw new Error('FAILED');
        }
    }, {
        delay: 0,
        maxAttempts: 4
    }));
    t.is(err.message, 'FAILED');
});
ava_1.default('should support factor property', async t => {
    let expectedDelays = [0, 100, 200, 400, 800];
    let lastTime = Date.now();
    return src_1.retry(async context => {
        let newTime = Date.now();
        let actualDelay = newTime - lastTime;
        lastTime = newTime;
        t.true(almostEqual(actualDelay, expectedDelays[context.attemptNum], DELAY_TOLERANCE));
        if (context.attemptsRemaining > 0) {
            throw new Error('FAILED');
        }
    }, {
        maxAttempts: expectedDelays.length,
        delay: 100,
        factor: 2
    });
});
ava_1.default('should support maximum delay', async t => {
    let expectedDelays = [0, 100, 200, 400, 800];
    let lastTime = Date.now();
    return src_1.retry(async context => {
        let newTime = Date.now();
        let actualDelay = newTime - lastTime;
        lastTime = newTime;
        t.true(almostEqual(actualDelay, Math.min(expectedDelays[context.attemptNum], 200), DELAY_TOLERANCE));
        if (context.attemptNum !== 4) {
            throw new Error('FAILED');
        }
    }, {
        maxAttempts: 0,
        delay: 100,
        maxDelay: 200,
        factor: 2
    });
});
ava_1.default('should support jitter', async t => {
    let expectedDelays = [0, 100, 200, 400, 800];
    let lastTime = Date.now();
    return src_1.retry(async context => {
        let newTime = Date.now();
        let actualDelay = newTime - lastTime;
        lastTime = newTime;
        t.true(actualDelay <= expectedDelays[context.attemptNum] + DELAY_TOLERANCE);
        if (context.attemptsRemaining === 0) {
            return 'success';
        } else {
            throw new Error('try again');
        }
    }, {
        maxAttempts: expectedDelays.length,
        delay: 100,
        factor: 2,
        jitter: true
    });
});
ava_1.default('should support jitter with minDelay', async t => {
    let expectedDelays = [0, 100, 200, 400, 800];
    let lastTime = Date.now();
    const minDelay = 100;
    return src_1.retry(async context => {
        let newTime = Date.now();
        let actualDelay = newTime - lastTime;
        lastTime = newTime;
        if (context.attemptNum > 0) {
            t.true(actualDelay >= minDelay);
        }
        t.true(actualDelay <= expectedDelays[context.attemptNum] + DELAY_TOLERANCE);
        if (context.attemptsRemaining === 0) {
            return 'success';
        } else {
            throw new Error('try again');
        }
    }, {
        maxAttempts: expectedDelays.length,
        delay: 100,
        minDelay,
        factor: 2,
        jitter: true
    });
});
ava_1.default('should detect invalid minDelay', async t => {
    const err = await t.throws(src_1.retry(async context => {
        throw new Error('should not get here');
    }, {
        delay: 100,
        minDelay: 200
    }));
    t.true(err.message.startsWith('delay cannot be less than minDelay'));
});
ava_1.default('should detect invalid integer option', async t => {
    for (const prop of ['delay', 'initialDelay', 'minDelay', 'maxDelay', 'maxAttempts', 'timeout']) {
        try {
            await src_1.retry(async context => {
                throw new Error('should not get here');
            }, {
                [prop]: -1
            });
        } catch (err) {
            t.is(err.message, `Value for ${prop} must be an integer greater than or equal to 0`);
        }
        try {
            await src_1.retry(async context => {
                throw new Error('should not get here');
            }, {
                [prop]: 'abc'
            });
        } catch (err) {
            t.is(err.message, `Value for ${prop} must be an integer greater than or equal to 0`);
        }
    }
});
ava_1.default('should detect invalid factor option', async t => {
    try {
        await src_1.retry(async context => {
            throw new Error('should not get here');
        }, {
            factor: -1
        });
    } catch (err) {
        t.is(err.message, `Value for factor must be a number greater than or equal to 0`);
    }
    try {
        const options = {};
        options.factor = 'abc';
        await src_1.retry(async context => {
            throw new Error('should not get here');
        }, options);
    } catch (err) {
        t.is(err.message, `Value for factor must be a number greater than or equal to 0`);
    }
});
ava_1.default('should allow attempts to be aborted via handleError', async t => {
    const err = await t.throws(src_1.retry(async context => {
        if (context.attemptNum === 1) {
            const err = new Error('Fatal error');
            err.retryable = false;
            throw err;
        } else {
            throw new Error('try again');
        }
    }, {
        delay: 0,
        maxAttempts: 4,
        handleError(err, context) {
            if (err.retryable === false) {
                context.abort();
            }
        }
    }));
    t.is(err.retryable, false);
});
ava_1.default('should allow handleError to return new error', async t => {
    const err = await t.throws(src_1.retry(async context => {
        if (context.attemptNum === 1) {
            const err = new Error('Fatal error');
            err.retryable = false;
            throw err;
        } else {
            throw new Error('try again');
        }
    }, {
        delay: 0,
        maxAttempts: 4,
        handleError(err, context) {
            if (err.retryable === false) {
                throw new Error('not retryable');
            }
        }
    }));
    t.is(err.message, 'not retryable');
});
ava_1.default('should allow attempts to be aborted via beforeAttempt', async t => {
    const err = await t.throws(src_1.retry(async context => {
        throw new Error('try again');
    }, {
        delay: 0,
        maxAttempts: 4,
        beforeAttempt(context) {
            if (context.attemptsRemaining === 3) {
                context.abort();
            }
        }
    }));
    t.is(err.code, 'ATTEMPT_ABORTED');
});
ava_1.default('should allow caller to provide calculateDelay function', async t => {
    let expectedDelays = [50, 150, 250, 350, 450];
    let lastTime = Date.now();
    return src_1.retry(async context => {
        let newTime = Date.now();
        let actualDelay = newTime - lastTime;
        lastTime = newTime;
        t.true(actualDelay <= expectedDelays[context.attemptNum] + DELAY_TOLERANCE);
        if (context.attemptsRemaining === 0) {
            return 'success';
        }
    }, {
        maxAttempts: expectedDelays.length,
        delay: 0,
        factor: 2,
        calculateDelay(context) {
            return context.attemptNum * 100 + 50;
        }
    });
});
ava_1.default('should allow for return type to be specified', async t => {
    const attemptFunc = () => ({ str: 'string', num: 25 });
    const result = await src_1.retry(async context => {
        // typescript will check to make sure
        // that the return value of attemptFunc
        // matches the TestResult interface
        return attemptFunc();
    });
    // since the TestResult type was given as the type argument,
    // typescript will automatically infer the type of 'result'.
    // accessing something like result.fieldThatDoesNotExist
    // will cause typescript to complain
    //
    // You can uncomment the line below to test that
    // t.is(result.fieldThatDoesNotExist, undefined);
    t.is(result.str, 'string');
    t.is(result.num, 25);
});
//# sourceMappingURL=index.test.js.map