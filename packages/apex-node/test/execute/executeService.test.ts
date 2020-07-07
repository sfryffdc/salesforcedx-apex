/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { assert, expect } from 'chai';
import * as fs from 'fs';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { ExecuteService } from '../../src/execute';
import { nls } from '../../src/i18n';
import { ExecuteAnonymousResponse } from '../../src/types';
import { ExecAnonResult } from '../../src/types/execute';

const $$ = testSetup();

describe('Apex Execute Tests', () => {
  const testData = new MockTestOrgData();
  let mockConnection: Connection;
  let sandboxStub: SinonSandbox;
  let fsStub: SinonStub;

  beforeEach(async () => {
    sandboxStub = createSandbox();
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    sandboxStub.stub(fs, 'readFileSync').returns('System.assert(true);');
    fsStub = sandboxStub.stub(fs, 'existsSync').returns(true);
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should execute and display successful result in correct format', async () => {
    const apexExecute = new ExecuteService(mockConnection);
    const log =
      '47.0 APEX_CODE,DEBUG;APEX_PROFILING,INFO\nExecute Anonymous: System.assert(true);|EXECUTION_FINISHED\n';
    const execAnonResult: ExecAnonResult = {
      result: {
        column: -1,
        line: -1,
        compiled: 'true',
        compileProblem: '',
        exceptionMessage: '',
        exceptionStackTrace: '',
        success: 'true'
      }
    };
    const soapResponse = {
      'soapenv:Envelope': {
        'soapenv:Header': { DebuggingInfo: { debugLog: log } },
        'soapenv:Body': {
          executeAnonymousResponse: execAnonResult
        }
      }
    };
    const expectedResult: ExecuteAnonymousResponse = {
      result: {
        column: -1,
        line: -1,
        compiled: true,
        compileProblem: '',
        exceptionMessage: '',
        exceptionStackTrace: '',
        success: true,
        logs: log
      }
    };
    sandboxStub
      .stub(ExecuteService.prototype, 'runRequest')
      .resolves(soapResponse);
    const response = await apexExecute.executeAnonymous({
      apexFilePath: 'filepath/to/anonApex/file'
    });

    expect(response).to.eql(expectedResult);
  });

  it('should execute and display runtime issue in correct format', async () => {
    const apexExecute = new ExecuteService(mockConnection);
    const log =
      '47.0 APEX_CODE,DEBUG;APEX_PROFILING,INFO\nExecute Anonymous: System.assert(false);|EXECUTION_FINISHED\n';
    const execAnonResult: ExecAnonResult = {
      result: {
        column: 1,
        line: 6,
        compiled: 'true',
        compileProblem: '',
        exceptionMessage: 'System.AssertException: Assertion Failed',
        exceptionStackTrace: 'AnonymousBlock: line 1, column 1',
        success: 'false'
      }
    };
    const soapResponse = {
      'soapenv:Envelope': {
        'soapenv:Header': { DebuggingInfo: { debugLog: log } },
        'soapenv:Body': {
          executeAnonymousResponse: execAnonResult
        }
      }
    };
    const expectedResult: ExecuteAnonymousResponse = {
      result: {
        column: 1,
        line: 6,
        compiled: true,
        compileProblem: '',
        exceptionMessage: 'System.AssertException: Assertion Failed',
        exceptionStackTrace: 'AnonymousBlock: line 1, column 1',
        success: false,
        logs: log
      }
    };
    sandboxStub
      .stub(ExecuteService.prototype, 'runRequest')
      .resolves(soapResponse);

    const response = await apexExecute.executeAnonymous({
      apexFilePath: 'filepath/to/anonApex/file'
    });
    expect(response).to.eql(expectedResult);
  });

  it('should execute and display compile issue in correct format', async () => {
    const apexExecute = new ExecuteService(mockConnection);
    const execAnonResult: ExecAnonResult = {
      result: {
        column: 1,
        line: 6,
        compiled: 'false',
        compileProblem: `Unexpected token '('.`,
        exceptionMessage: '',
        exceptionStackTrace: '',
        success: 'false'
      }
    };
    const soapResponse = {
      'soapenv:Envelope': {
        'soapenv:Header': { DebuggingInfo: { debugLog: '' } },
        'soapenv:Body': {
          executeAnonymousResponse: execAnonResult
        }
      }
    };

    const expectedResult: ExecuteAnonymousResponse = {
      result: {
        column: 1,
        line: 6,
        compiled: false,
        compileProblem: `Unexpected token '('.`,
        exceptionMessage: '',
        exceptionStackTrace: '',
        success: false,
        logs: ''
      }
    };
    sandboxStub
      .stub(ExecuteService.prototype, 'runRequest')
      .resolves(soapResponse);

    const response = await apexExecute.executeAnonymous({
      apexFilePath: 'filepath/to/anonApex/file'
    });
    expect(response).to.eql(expectedResult);
  });

  it('should handle access token session id error correctly', async () => {
    const apexExecute = new ExecuteService(mockConnection);
    const log =
      '47.0 APEX_CODE,DEBUG;APEX_PROFILING,INFO\nExecute Anonymous: System.assert(true);|EXECUTION_FINISHED\n';
    const execAnonResult: ExecAnonResult = {
      result: {
        column: -1,
        line: -1,
        compiled: 'true',
        compileProblem: '',
        exceptionMessage: '',
        exceptionStackTrace: '',
        success: 'true'
      }
    };
    const soapResponse = {
      'soapenv:Envelope': {
        'soapenv:Header': { DebuggingInfo: { debugLog: log } },
        'soapenv:Body': {
          executeAnonymousResponse: execAnonResult
        }
      }
    };
    const expectedResult: ExecuteAnonymousResponse = {
      result: {
        column: -1,
        line: -1,
        compiled: true,
        compileProblem: '',
        exceptionMessage: '',
        exceptionStackTrace: '',
        success: true,
        logs: log
      }
    };

    let count = 0;
    // @ts-ignore
    $$.fakeConnectionRequest = request => {
      if (count === 0) {
        const error = new Error('INVALID_SESSION_ID');
        error.name = 'ERROR_HTTP_500';
        count += 1;
        return Promise.reject(error);
      } else if (count === 1 || count === 2) {
        count += 1;
        return Promise.resolve(soapResponse);
      } else {
        return Promise.reject(
          new Error(`count => ${count}, Unexpected request on mock ${request}`)
        );
      }
    };
    const response = await apexExecute.executeAnonymous({
      apexFilePath: 'filepath/to/anonApex/file'
    });
    expect(response).to.eql(expectedResult);
    expect(count).to.equal(3);
  });

  it('should raise an error when the source file is not found', async () => {
    const apexFile = 'filepath/to/anonApex/file';
    const apexExecute = new ExecuteService(mockConnection);
    fsStub.restore();
    fsStub.returns(false);

    try {
      await apexExecute.executeAnonymous({ apexFilePath: apexFile });
      assert.fail('Expected an error');
    } catch (e) {
      assert.equal(nls.localize('file_not_found_error', apexFile), e.message);
    }
  });

  it('should handle Buffer input correctly', async () => {
    const apexExecute = new ExecuteService(mockConnection);
    const log =
      '47.0 APEX_CODE,DEBUG;APEX_PROFILING,INFO\nExecute Anonymous: System.assert(true);|EXECUTION_FINISHED\n';
    const bufferInput = Buffer.from('System.assert(true);');
    const execAnonResult: ExecAnonResult = {
      result: {
        column: -1,
        line: -1,
        compiled: 'true',
        compileProblem: '',
        exceptionMessage: '',
        exceptionStackTrace: '',
        success: 'true'
      }
    };
    const soapResponse = {
      'soapenv:Envelope': {
        'soapenv:Header': { DebuggingInfo: { debugLog: log } },
        'soapenv:Body': {
          executeAnonymousResponse: execAnonResult
        }
      }
    };
    const expectedResult: ExecuteAnonymousResponse = {
      result: {
        column: -1,
        line: -1,
        compiled: true,
        compileProblem: '',
        exceptionMessage: '',
        exceptionStackTrace: '',
        success: true,
        logs: log
      }
    };
    sandboxStub
      .stub(ExecuteService.prototype, 'runRequest')
      .resolves(soapResponse);
    const response = await apexExecute.executeAnonymous({
      apexCode: bufferInput
    });

    expect(response).to.eql(expectedResult);
  });
});
