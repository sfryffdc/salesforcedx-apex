/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { expect } from 'chai';
import {
  assert,
  createSandbox,
  SinonSandbox,
  SinonSpy,
  SinonStub
} from 'sinon';
import {
  SyncTestConfiguration,
  TestService,
  OutputDirConfig
} from '../../src/tests';
import {
  AsyncTestConfiguration,
  TestLevel,
  ApexTestQueueItemStatus,
  ApexTestResultOutcome,
  ApexTestQueueItem,
  ApexTestRunResultStatus,
  ApexTestRunResult,
  ApexTestResult,
  ApexOrgWideCoverage,
  ApexCodeCoverageAggregate,
  ApexCodeCoverage,
  ApexTestQueueItemRecord
} from '../../src/tests/types';
import { AsyncTestRun, StreamingClient } from '../../src/streaming';
import { fail } from 'assert';
import { nls } from '../../src/i18n';
import {
  codeCoverageQueryResult,
  mixedPerClassCodeCoverage,
  mixedTestResults,
  missingTimeTestData,
  perClassCodeCoverage,
  syncTestResultSimple,
  syncTestResultWithFailures,
  testResultData,
  testRunId,
  testStartTime,
  diagnosticFailure,
  diagnosticResult
} from './testData';
import { join } from 'path';
import * as stream from 'stream';
import * as fs from 'fs';
import { JUnitReporter, TapReporter } from '../../src';

const $$ = testSetup();
let mockConnection: Connection;
let sandboxStub: SinonSandbox;
let toolingRequestStub: SinonStub;
let toolingQueryStub: SinonStub;
const testData = new MockTestOrgData();

describe('Run Apex tests synchronously', () => {
  let testRequest = {};
  const requestOptions: SyncTestConfiguration = {
    tests: [{ className: 'TestSample' }],
    maxFailedTests: 2,
    testLevel: 'RunSpecifiedTests'
  };

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
    toolingRequestStub = sandboxStub.stub(mockConnection.tooling, 'request');
    toolingQueryStub = sandboxStub.stub(mockConnection.tooling, 'query');
    testRequest = {
      method: 'POST',
      url: `${mockConnection.tooling._baseUrl()}/runTestsSynchronous`,
      body: JSON.stringify(requestOptions),
      headers: { 'content-type': 'application/json' }
    };
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should run a successful test', async () => {
    toolingRequestStub.withArgs(testRequest).returns(syncTestResultSimple);
    const testSrv = new TestService(mockConnection);
    const testResult = await testSrv.runTestSynchronous(requestOptions);
    expect(testResult).to.be.a('object');
    expect(toolingRequestStub.calledOnce).to.equal(true);
    expect(testResult.summary).to.be.a('object');
    expect(testResult.summary.failRate).to.equal('0%');
    expect(testResult.summary.testsRan).to.equal(1);
    expect(testResult.summary.orgId).to.equal(
      mockConnection.getAuthInfoFields().orgId
    );
    expect(testResult.summary.outcome).to.equal('Passed');
    expect(testResult.summary.passRate).to.equal('100%');
    expect(testResult.summary.skipRate).to.equal('0%');
    expect(testResult.summary.testExecutionTimeInMs).to.equal(270);
    expect(testResult.summary.username).to.equal(mockConnection.getUsername());

    expect(testResult.tests).to.be.a('array');
    expect(testResult.tests.length).to.equal(1);
    expect(testResult.tests[0].queueItemId).to.equal('');
    expect(testResult.tests[0].stackTrace).to.equal('');
    expect(testResult.tests[0].message).to.equal('');
    expect(testResult.tests[0].asyncApexJobId).to.equal('');
    expect(testResult.tests[0].methodName).to.equal('testOne');
    expect(testResult.tests[0].outcome).to.equal('Pass');
    expect(testResult.tests[0].apexLogId).to.equal('07Lxx00000cxy6YUAQ');
    expect(testResult.tests[0].apexClass).to.be.a('object');
    expect(testResult.tests[0].apexClass.id).to.equal('01pxx00000NWwb3AAD');
    expect(testResult.tests[0].apexClass.name).to.equal('TestSample');
    expect(testResult.tests[0].apexClass.namespacePrefix).to.equal(null);
    expect(testResult.tests[0].apexClass.fullName).to.equal('TestSample');
    expect(testResult.tests[0].runTime).to.equal(107);
    expect(testResult.tests[0].testTimestamp).to.equal('');
    expect(testResult.tests[0].fullName).to.equal('TestSample.testOne');
  });

  it('should run a test with failures', async () => {
    toolingRequestStub
      .withArgs(testRequest)
      .returns(syncTestResultWithFailures);
    const testSrv = new TestService(mockConnection);
    const testResult = await testSrv.runTestSynchronous(requestOptions);
    expect(testResult).to.be.a('object');
    expect(toolingRequestStub.calledOnce).to.equal(true);
    expect(testResult.summary).to.be.a('object');
    expect(testResult.summary.failRate).to.equal('100%');
    expect(testResult.summary.testsRan).to.equal(1);
    expect(testResult.summary.orgId).to.equal(
      mockConnection.getAuthInfoFields().orgId
    );
    expect(testResult.summary.outcome).to.equal('Failed');
    expect(testResult.summary.passRate).to.equal('0%');
    expect(testResult.summary.skipRate).to.equal('0%');
    expect(testResult.summary.testExecutionTimeInMs).to.equal(87);
    expect(testResult.summary.username).to.equal(mockConnection.getUsername());

    expect(testResult.tests).to.be.a('array');
    expect(testResult.tests.length).to.equal(1);
    expect(testResult.tests[0].queueItemId).to.equal('');
    expect(testResult.tests[0].stackTrace).to.equal(
      'Class.TestSample.testOne: line 27, column 1'
    );
    expect(testResult.tests[0].message).to.equal(
      'System.AssertException: Assertion Failed: Expected: false, Actual: true'
    );
    expect(testResult.tests[0].asyncApexJobId).to.equal('');
    expect(testResult.tests[0].methodName).to.equal('testOne');
    expect(testResult.tests[0].outcome).to.equal('Fail');
    expect(testResult.tests[0].apexLogId).to.equal('07Lxx00000cxy6YUAQ');
    expect(testResult.tests[0].apexClass).to.be.a('object');
    expect(testResult.tests[0].apexClass.id).to.equal('01pxx00000NWwb3AAD');
    expect(testResult.tests[0].apexClass.name).to.equal('TestSample');
    expect(testResult.tests[0].apexClass.namespacePrefix).to.equal('tr');
    expect(testResult.tests[0].apexClass.fullName).to.equal('tr__TestSample');
    expect(testResult.tests[0].runTime).to.equal(68);
    expect(testResult.tests[0].testTimestamp).to.equal('');
    expect(testResult.tests[0].fullName).to.equal('tr__TestSample.testOne');
  });

  it('should run a test with code coverage', async () => {
    toolingRequestStub.withArgs(testRequest).returns(syncTestResultSimple);
    toolingQueryStub.onCall(0).resolves({
      done: true,
      totalSize: 3,
      records: perClassCodeCoverage
    } as ApexCodeCoverage);
    toolingQueryStub.onCall(1).resolves({
      done: true,
      totalSize: 3,
      records: codeCoverageQueryResult
    } as ApexCodeCoverageAggregate);
    toolingQueryStub.onCall(2).resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          PercentCovered: '35'
        }
      ]
    } as ApexOrgWideCoverage);

    const testSrv = new TestService(mockConnection);
    const testResult = await testSrv.runTestSynchronous(requestOptions, true);
    expect(testResult).to.be.a('object');
    expect(toolingRequestStub.calledOnce).to.equal(true);
    expect(testResult.summary).to.be.a('object');
    expect(testResult.summary.testRunCoverage).to.equal('66%');
    expect(testResult.summary.orgWideCoverage).to.equal('35%');
    expect(testResult.tests).to.be.a('array');
    expect(testResult.tests.length).to.equal(1);
    expect(testResult.codecoverage).to.be.a('array');
    expect(testResult.codecoverage.length).to.equal(3);
  });

  describe('Build sync payload', async () => {
    it('should build synchronous payload for tests without namespace', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildSyncPayload(
        TestLevel.RunSpecifiedTests,
        'myClass.myTest'
      );

      expect(payload).to.deep.equal({
        tests: [{ className: 'myClass', testMethods: ['myTest'] }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.calledOnce).to.be.true;
    });

    it('should build synchronous payload for tests with namespace', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildSyncPayload(
        TestLevel.RunSpecifiedTests,
        'myNamespace.myClass.myTest'
      );

      expect(payload).to.deep.equal({
        tests: [
          {
            namespace: 'myNamespace',
            className: 'myClass',
            testMethods: ['myTest']
          }
        ],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.notCalled).to.be.true;
    });

    it('should build synchronous payload for class without namespace', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildSyncPayload(
        TestLevel.RunSpecifiedTests,
        undefined,
        'myClass'
      );

      expect(payload).to.deep.equal({
        tests: [{ className: 'myClass' }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.notCalled).to.be.true;
    });

    it('should build synchronous payload for class with namespace', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildSyncPayload(
        TestLevel.RunSpecifiedTests,
        undefined,
        'myNamespace.myClass'
      );

      expect(payload).to.deep.equal({
        tests: [{ className: 'myNamespace.myClass' }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.notCalled).to.be.true;
    });

    it('should throw an error if multiple classes are specified', async () => {
      const testSrv = new TestService(mockConnection);

      try {
        await testSrv.buildSyncPayload(
          TestLevel.RunSpecifiedTests,
          'myNamespace.myClass.myTest, myNamespace.otherClass.otherTest'
        );
        assert.fail();
      } catch (e) {
        expect(e.message).to.equal(nls.localize('syncClassErr'));
      }
    });
  });
});

describe('Run Apex tests asynchronously', () => {
  let timeStub: SinonStub;
  const pollResponse: ApexTestQueueItem = {
    done: true,
    totalSize: 1,
    records: [
      {
        Id: '7092M000000Vt94QAC',
        Status: ApexTestQueueItemStatus.Completed,
        ApexClassId: '01p2M00000O6tXZQAZ',
        TestRunResultId: '05m2M000000TgYuQAK'
      }
    ]
  };

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
    sandboxStub.stub(mockConnection, 'instanceUrl').get(() => {
      return 'https://na139.salesforce.com';
    });
    timeStub = sandboxStub
      .stub(Date.prototype, 'getTime')
      .onFirstCall()
      .returns(6000);
    timeStub.onSecondCall().returns(8000);
    testResultData.summary.orgId = mockConnection.getAuthInfoFields().orgId;
    testResultData.summary.username = mockConnection.getUsername();
    toolingRequestStub = sandboxStub.stub(mockConnection.tooling, 'request');
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should run a successful test', async () => {
    const asyncResult = {
      runId: testRunId,
      queueItem: pollResponse
    } as AsyncTestRun;
    const requestOptions: AsyncTestConfiguration = {
      classNames: 'TestSample',
      testLevel: TestLevel.RunSpecifiedTests
    };

    const testAsyncRequest = {
      method: 'POST',
      url: `${mockConnection.tooling._baseUrl()}/runTestsAsynchronous`,
      body: JSON.stringify(requestOptions),
      headers: { 'content-type': 'application/json' }
    };

    toolingRequestStub.withArgs(testAsyncRequest).returns(testRunId);
    sandboxStub
      .stub(StreamingClient.prototype, 'subscribe')
      .resolves(asyncResult);
    const testSrv = new TestService(mockConnection);
    const mockTestResultData = sandboxStub
      .stub(testSrv, 'formatAsyncResults')
      .resolves(testResultData);
    sandboxStub.stub(StreamingClient.prototype, 'handshake').resolves();
    const testResult = await testSrv.runTestAsynchronous(requestOptions);
    expect(testResult).to.be.a('object');
    expect(mockTestResultData.calledOnce).to.equal(true);
    expect(mockTestResultData.getCall(0).args[0]).to.equal(
      asyncResult.queueItem
    );
    expect(mockTestResultData.getCall(0).args[1]).to.equal(asyncResult.runId);
    expect(testResult).to.equal(testResultData);
  });

  it('should throw an error on refresh token issue', async () => {
    const requestOptions: AsyncTestConfiguration = {
      classNames: 'TestSample',
      testLevel: TestLevel.RunSpecifiedTests
    };

    sandboxStub
      .stub(StreamingClient.prototype, 'init')
      .throwsException('No access token');
    const testSrv = new TestService(mockConnection);
    try {
      await testSrv.runTestAsynchronous(requestOptions);
      fail('Test should have thrown an error');
    } catch (e) {
      expect(e.name).to.equal('No access token');
    }
  });

  it('should return formatted test results', async () => {
    missingTimeTestData.summary.orgId = mockConnection.getAuthInfoFields().orgId;
    missingTimeTestData.summary.username = mockConnection.getUsername();
    const testSrv = new TestService(mockConnection);
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    mockToolingQuery.onFirstCall().resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          AsyncApexJobId: testRunId,
          Status: ApexTestRunResultStatus.Completed,
          StartTime: testStartTime,
          TestTime: null,
          UserId: '005xx000000abcDAAU'
        }
      ]
    } as ApexTestRunResult);

    mockToolingQuery.onSecondCall().resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          Id: '07Mxx00000F2Xx6UAF',
          QueueItemId: '7092M000000Vt94QAC',
          StackTrace: null,
          Message: null,
          AsyncApexJobId: testRunId,
          MethodName: 'testLoggerLog',
          Outcome: ApexTestResultOutcome.Pass,
          ApexLogId: null,
          ApexClass: {
            Id: '01pxx00000O6tXZQAZ',
            Name: 'TestLogger',
            NamespacePrefix: 't3st',
            FullName: 't3st__TestLogger'
          },
          RunTime: null,
          TestTimestamp: '3'
        }
      ]
    } as ApexTestResult);

    const getTestResultData = await testSrv.formatAsyncResults(
      pollResponse,
      testRunId,
      new Date().getTime()
    );

    let summaryQuery =
      'SELECT AsyncApexJobId, Status, ClassesCompleted, ClassesEnqueued, ';
    summaryQuery += 'MethodsEnqueued, StartTime, EndTime, TestTime, UserId ';
    summaryQuery += `FROM ApexTestRunResult WHERE AsyncApexJobId = '${testRunId}'`;
    expect(mockToolingQuery.getCall(0).args[0]).to.equal(summaryQuery);

    let testResultQuery = 'SELECT Id, QueueItemId, StackTrace, Message, ';
    testResultQuery +=
      'RunTime, TestTimestamp, AsyncApexJobId, MethodName, Outcome, ApexLogId, ';
    testResultQuery +=
      'ApexClass.Id, ApexClass.Name, ApexClass.NamespacePrefix ';
    testResultQuery += `FROM ApexTestResult WHERE QueueItemId IN ('${pollResponse.records[0].Id}')`;
    expect(mockToolingQuery.getCall(1).args[0]).to.equal(testResultQuery);
    expect(getTestResultData).to.deep.equals(missingTimeTestData);
  });

  it('should return formatted test results with diagnostics', async () => {
    diagnosticResult.summary.orgId = mockConnection.getAuthInfoFields().orgId;
    diagnosticResult.summary.username = mockConnection.getUsername();
    const testSrv = new TestService(mockConnection);
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    mockToolingQuery.onFirstCall().resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          AsyncApexJobId: testRunId,
          Status: ApexTestRunResultStatus.Completed,
          StartTime: testStartTime,
          TestTime: null,
          UserId: '005xx000000abcDAAU'
        }
      ]
    } as ApexTestRunResult);

    mockToolingQuery.onSecondCall().resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          Id: '07Mxx00000F2Xx6UAF',
          QueueItemId: '7092M000000Vt94QAC',
          StackTrace: 'Class.LIFXControllerTest.makeData: line 6, column 1',
          Message: 'System.AssertException: Assertion Failed',
          AsyncApexJobId: testRunId,
          MethodName: 'testLoggerLog',
          Outcome: ApexTestResultOutcome.Fail,
          ApexLogId: null,
          ApexClass: {
            Id: '01pxx00000O6tXZQAZ',
            Name: 'TestLogger',
            NamespacePrefix: 't3st',
            FullName: 't3st__TestLogger'
          },
          RunTime: null,
          TestTimestamp: '3'
        }
      ]
    } as ApexTestResult);

    const getTestResultData = await testSrv.formatAsyncResults(
      pollResponse,
      testRunId,
      new Date().getTime()
    );

    expect(getTestResultData).to.deep.equals(diagnosticResult);
  });

  it('should return failed test results with missing error info', async () => {
    diagnosticFailure.summary.orgId = mockConnection.getAuthInfoFields().orgId;
    diagnosticFailure.summary.username = mockConnection.getUsername();
    const testSrv = new TestService(mockConnection);
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    mockToolingQuery.onFirstCall().resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          AsyncApexJobId: testRunId,
          Status: ApexTestRunResultStatus.Completed,
          StartTime: testStartTime,
          TestTime: null,
          UserId: '005xx000000abcDAAU'
        }
      ]
    } as ApexTestRunResult);

    mockToolingQuery.onSecondCall().resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          Id: '07Mxx00000F2Xx6UAF',
          QueueItemId: '7092M000000Vt94QAC',
          StackTrace: 'Class.LIFXControllerTest.makeData',
          Message: 'System.AssertException: Assertion Failed',
          AsyncApexJobId: testRunId,
          MethodName: 'testLoggerLog',
          Outcome: ApexTestResultOutcome.Fail,
          ApexLogId: null,
          ApexClass: {
            Id: '01pxx00000O6tXZQAZ',
            Name: 'TestLogger',
            NamespacePrefix: 't3st',
            FullName: 't3st__TestLogger'
          },
          RunTime: null,
          TestTimestamp: '3'
        }
      ]
    } as ApexTestResult);

    const getTestResultData = await testSrv.formatAsyncResults(
      pollResponse,
      testRunId,
      new Date().getTime()
    );

    expect(getTestResultData).to.deep.equals(diagnosticFailure);
  });

  it('should return an error if no test results are found', async () => {
    const testSrv = new TestService(mockConnection);
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    mockToolingQuery.onFirstCall().resolves({
      done: true,
      totalSize: 0,
      records: []
    } as ApexTestRunResult);

    try {
      await testSrv.formatAsyncResults(
        pollResponse,
        testRunId,
        new Date().getTime()
      );
      fail('Test should have thrown an error');
    } catch (e) {
      expect(e.message).to.equal(
        nls.localize('no_test_result_summary', testRunId)
      );
    }
  });

  it('should return formatted test results with code coverage', async () => {
    const testSrv = new TestService(mockConnection);
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    mockToolingQuery.onCall(0).resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          AsyncApexJobId: testRunId,
          Status: ApexTestRunResultStatus.Completed,
          StartTime: '2020-07-12T02:54:47.000+0000',
          TestTime: 1765,
          UserId: '005xx000000abcDAAU'
        }
      ]
    } as ApexTestRunResult);

    mockToolingQuery.onCall(1).resolves({
      done: true,
      totalSize: 6,
      records: mixedTestResults
    } as ApexTestResult);

    mockToolingQuery.onCall(2).resolves({
      done: true,
      totalSize: 3,
      records: mixedPerClassCodeCoverage
    } as ApexCodeCoverage);

    mockToolingQuery.onCall(3).resolves({
      done: true,
      totalSize: 3,
      records: codeCoverageQueryResult
    } as ApexCodeCoverageAggregate);

    mockToolingQuery.onCall(4).resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          PercentCovered: '57'
        }
      ]
    } as ApexOrgWideCoverage);

    const getTestResultData = await testSrv.formatAsyncResults(
      pollResponse,
      testRunId,
      new Date().getTime(),
      true
    );

    // verify summary data
    expect(getTestResultData.summary.failRate).to.equal('33%');
    expect(getTestResultData.summary.testsRan).to.equal(6);
    expect(getTestResultData.summary.orgId).to.equal(
      mockConnection.getAuthInfoFields().orgId
    );
    expect(getTestResultData.summary.outcome).to.equal('Failed');
    expect(getTestResultData.summary.passRate).to.equal('50%');
    expect(getTestResultData.summary.skipRate).to.equal('17%');
    expect(getTestResultData.summary.username).to.equal(
      mockConnection.getUsername()
    );
    expect(getTestResultData.summary.orgWideCoverage).to.equal('57%');
    expect(getTestResultData.summary.testRunCoverage).to.equal('66%');
    expect(getTestResultData.tests.length).to.equal(6);
    expect(getTestResultData.codecoverage.length).to.equal(3);
  });

  describe('Check Query Limits', async () => {
    const queryStart =
      'SELECT Id, QueueItemId, StackTrace, Message, RunTime, TestTimestamp, AsyncApexJobId, MethodName, Outcome, ApexLogId, ApexClass.Id, ApexClass.Name, ApexClass.NamespacePrefix FROM ApexTestResult WHERE QueueItemId IN ';

    const record = {
      Id: '7092M000000Vt94QAC',
      Status: ApexTestQueueItemStatus.Completed,
      ApexClassId: '01p2M00000O6tXZQAZ',
      TestRunResultId: '05m2M000000TgYuQAK'
    };
    const records: ApexTestQueueItemRecord[] = [];
    const queryIds: string[] = [];
    let count = 700;
    while (count > 0) {
      records.push(record);
      queryIds.push(record.Id);
      count--;
    }

    const testQueueItems: ApexTestQueueItem = {
      done: true,
      totalSize: 700,
      records
    };

    it('should split into multiple queries if query is longer than char limit', async () => {
      const mockToolingQuery = sandboxStub.stub(
        mockConnection.tooling,
        'query'
      );
      mockToolingQuery.onFirstCall().resolves({
        done: true,
        totalSize: 600,
        records: [
          {
            Id: '07Mxx00000F2Xx6UAF',
            QueueItemId: '7092M000000Vt94QAC',
            StackTrace: null,
            Message: null,
            AsyncApexJobId: testRunId,
            MethodName: 'testLoggerLog',
            Outcome: ApexTestResultOutcome.Pass,
            ApexLogId: null,
            ApexClass: {
              Id: '01pxx00000O6tXZQAZ',
              Name: 'TestLogger',
              NamespacePrefix: 't3st',
              FullName: 't3st__TestLogger'
            },
            RunTime: 8,
            TestTimestamp: '3'
          }
        ]
      } as ApexTestResult);
      mockToolingQuery.onSecondCall().resolves({
        done: true,
        totalSize: 100,
        records: [
          {
            Id: '07Mxx00000F2Xx6UAF',
            QueueItemId: '7092M000000Vt94QAC',
            StackTrace: null,
            Message: null,
            AsyncApexJobId: testRunId,
            MethodName: 'testLoggerLog',
            Outcome: ApexTestResultOutcome.Pass,
            ApexLogId: null,
            ApexClass: {
              Id: '01pxx00000O6tXZQAZ',
              Name: 'TestLogger',
              NamespacePrefix: 't3st',
              FullName: 't3st__TestLogger'
            },
            RunTime: 8,
            TestTimestamp: '3'
          }
        ]
      } as ApexTestResult);

      const testSrv = new TestService(mockConnection);
      const result = await testSrv.getAsyncTestResults(testQueueItems);

      expect(mockToolingQuery.calledTwice).to.be.true;
      expect(result.length).to.eql(2);
    });

    it('should make a single api call if query is under char limit', async () => {
      const mockToolingQuery = sandboxStub.stub(
        mockConnection.tooling,
        'query'
      );
      mockToolingQuery.onFirstCall().resolves({
        done: true,
        totalSize: 1,
        records: [
          {
            Id: '07Mxx00000F2Xx6UAF',
            QueueItemId: '7092M000000Vt94QAC',
            StackTrace: null,
            Message: null,
            AsyncApexJobId: testRunId,
            MethodName: 'testLoggerLog',
            Outcome: ApexTestResultOutcome.Pass,
            ApexLogId: null,
            ApexClass: {
              Id: '01pxx00000O6tXZQAZ',
              Name: 'TestLogger',
              NamespacePrefix: 't3st',
              FullName: 't3st__TestLogger'
            },
            RunTime: 8,
            TestTimestamp: '3'
          }
        ]
      } as ApexTestResult);

      const testSrv = new TestService(mockConnection);
      const result = await testSrv.getAsyncTestResults(pollResponse);

      expect(mockToolingQuery.calledOnce).to.be.true;
      expect(result.length).to.eql(1);
    });

    it('should format multiple queries correctly', async () => {
      const queryOneIds = queryIds.slice(0, 120).join("','");
      const queryOne = `${queryStart}('${queryOneIds}')`;
      const queryTwoIds = queryIds.slice(120).join("','");
      const queryTwo = `${queryStart}('${queryTwoIds}')`;

      const testQueueItems: ApexTestQueueItem = {
        done: true,
        totalSize: 700,
        records
      };

      const mockToolingQuery = sandboxStub.stub(
        mockConnection.tooling,
        'query'
      );
      mockToolingQuery.onFirstCall().resolves({
        done: true,
        totalSize: 600,
        records: [
          {
            Id: '07Mxx00000F2Xx6UAF',
            QueueItemId: '7092M000000Vt94QAC',
            StackTrace: null,
            Message: null,
            AsyncApexJobId: testRunId,
            MethodName: 'testLoggerLog',
            Outcome: ApexTestResultOutcome.Pass,
            ApexLogId: null,
            ApexClass: {
              Id: '01pxx00000O6tXZQAZ',
              Name: 'TestLogger',
              NamespacePrefix: 't3st',
              FullName: 't3st__TestLogger'
            },
            RunTime: 8,
            TestTimestamp: '3'
          }
        ]
      } as ApexTestResult);
      mockToolingQuery.onSecondCall().resolves({
        done: true,
        totalSize: 100,
        records: [
          {
            Id: '07Mxx00000F2Xx6UAF',
            QueueItemId: '7092M000000Vt94QAC',
            StackTrace: null,
            Message: null,
            AsyncApexJobId: testRunId,
            MethodName: 'testLoggerLog',
            Outcome: ApexTestResultOutcome.Pass,
            ApexLogId: null,
            ApexClass: {
              Id: '01pxx00000O6tXZQAZ',
              Name: 'TestLogger',
              NamespacePrefix: 't3st',
              FullName: 't3st__TestLogger'
            },
            RunTime: 8,
            TestTimestamp: '3'
          }
        ]
      } as ApexTestResult);

      const testSrv = new TestService(mockConnection);
      const result = await testSrv.getAsyncTestResults(testQueueItems);

      expect(mockToolingQuery.calledTwice).to.be.true;
      expect(result.length).to.eql(2);
      expect(mockToolingQuery.calledWith(queryOne)).to.be.true;
      expect(mockToolingQuery.calledWith(queryTwo)).to.be.true;
    });

    it('should format query at query limit correctly', async () => {
      const record = {
        Id: '7092M000000Vt94QAC',
        Status: ApexTestQueueItemStatus.Completed,
        ApexClassId: '01p2M00000O6tXZQAZ',
        TestRunResultId: '05m2M000000TgYuQAK'
      };

      const queryOneIds = queryIds.slice(0, 120).join("','");
      const queryOne = `${queryStart}('${queryOneIds}')`;

      const testQueueItems: ApexTestQueueItem = {
        done: true,
        totalSize: 700,
        records
      };

      const mockToolingQuery = sandboxStub.stub(
        mockConnection.tooling,
        'query'
      );
      mockToolingQuery.onFirstCall().resolves({
        done: true,
        totalSize: 600,
        records: [
          {
            Id: '07Mxx00000F2Xx6UAF',
            QueueItemId: '7092M000000Vt94QAC',
            StackTrace: null,
            Message: null,
            AsyncApexJobId: testRunId,
            MethodName: 'testLoggerLog',
            Outcome: ApexTestResultOutcome.Pass,
            ApexLogId: null,
            ApexClass: {
              Id: '01pxx00000O6tXZQAZ',
              Name: 'TestLogger',
              NamespacePrefix: 't3st',
              FullName: 't3st__TestLogger'
            },
            RunTime: 8,
            TestTimestamp: '3'
          }
        ]
      } as ApexTestResult);
      mockToolingQuery.onSecondCall().resolves({
        done: true,
        totalSize: 100,
        records: [
          {
            Id: '07Mxx00000F2Xx6UAF',
            QueueItemId: '7092M000000Vt94QAC',
            StackTrace: null,
            Message: null,
            AsyncApexJobId: testRunId,
            MethodName: 'testLoggerLog',
            Outcome: ApexTestResultOutcome.Pass,
            ApexLogId: null,
            ApexClass: {
              Id: '01pxx00000O6tXZQAZ',
              Name: 'TestLogger',
              NamespacePrefix: 't3st',
              FullName: 't3st__TestLogger'
            },
            RunTime: 8,
            TestTimestamp: '3'
          }
        ]
      } as ApexTestResult);

      const testSrv = new TestService(mockConnection);
      const result = await testSrv.getAsyncTestResults(testQueueItems);

      expect(mockToolingQuery.calledTwice).to.be.true;
      expect(result.length).to.eql(2);
      expect(mockToolingQuery.calledWith(queryOne)).to.be.true;
      expect(mockToolingQuery.calledWith(`${queryStart}('${record.Id}')`));
    });

    it('should format single query correctly', async () => {
      const mockToolingQuery = sandboxStub.stub(
        mockConnection.tooling,
        'query'
      );
      const id = '7092M000000Vt94QAC';
      mockToolingQuery.onFirstCall().resolves({
        done: true,
        totalSize: 1,
        records: [
          {
            Id: '07Mxx00000F2Xx6UAF',
            QueueItemId: id,
            StackTrace: null,
            Message: null,
            AsyncApexJobId: testRunId,
            MethodName: 'testLoggerLog',
            Outcome: ApexTestResultOutcome.Pass,
            ApexLogId: null,
            ApexClass: {
              Id: '01pxx00000O6tXZQAZ',
              Name: 'TestLogger',
              NamespacePrefix: 't3st',
              FullName: 't3st__TestLogger'
            },
            RunTime: 8,
            TestTimestamp: '3'
          }
        ]
      } as ApexTestResult);
      const singleQuery = `${queryStart}('${id}')`;

      const testSrv = new TestService(mockConnection);
      const result = await testSrv.getAsyncTestResults(pollResponse);

      expect(mockToolingQuery.calledOnce).to.be.true;
      expect(mockToolingQuery.calledWith(singleQuery)).to.be.true;
      expect(result.length).to.eql(1);
    });
  });

  describe('Create Result Files', () => {
    let createStreamStub: SinonStub;
    let stringifySpy: SinonSpy;
    let junitSpy: SinonSpy;
    let tapSpy: SinonSpy;

    beforeEach(async () => {
      sandboxStub = createSandbox();
      sandboxStub.stub(fs, 'existsSync').returns(true);
      sandboxStub.stub(fs, 'mkdirSync');
      createStreamStub = sandboxStub.stub(fs, 'createWriteStream');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createStreamStub.returns(new stream.PassThrough() as any);
      sandboxStub.stub(fs, 'closeSync');
      sandboxStub.stub(fs, 'openSync');
      stringifySpy = sandboxStub.spy(TestService.prototype, 'stringify');
      junitSpy = sandboxStub.spy(JUnitReporter.prototype, 'format');
      tapSpy = sandboxStub.spy(TapReporter.prototype, 'format');
    });

    afterEach(() => {
      timeStub.restore();
      sandboxStub.restore();
    });

    it('should only create test-run-id.txt if no result format nor fileInfos are specified', async () => {
      const config = {
        dirPath: 'path/to/directory'
      } as OutputDirConfig;
      const testSrv = new TestService(mockConnection);
      await testSrv.writeResultFiles(testResultData, config);

      expect(
        createStreamStub.calledWith(join(config.dirPath, 'test-run-id.txt'))
      ).to.be.true;
      expect(createStreamStub.callCount).to.eql(1);
    });

    it('should create the json files if json result format is specified', async () => {
      const config = {
        dirPath: 'path/to/directory',
        resultFormat: 'json'
      } as OutputDirConfig;
      const testSrv = new TestService(mockConnection);
      await testSrv.writeResultFiles(testResultData, config);

      expect(
        createStreamStub.calledWith(
          join(config.dirPath, `test-result-${testRunId}.json`)
        )
      ).to.be.true;
      expect(stringifySpy.calledOnce).to.be.true;
      expect(createStreamStub.callCount).to.eql(2);
    });

    it('should create the junit result files if junit result format is specified', async () => {
      const config = {
        dirPath: 'path/to/directory',
        resultFormat: 'junit'
      } as OutputDirConfig;
      const testSrv = new TestService(mockConnection);
      await testSrv.writeResultFiles(testResultData, config);

      expect(
        createStreamStub.calledWith(
          join(config.dirPath, `test-result-${testRunId}-junit.xml`)
        )
      ).to.be.true;
      expect(junitSpy.calledOnce).to.be.true;
      expect(createStreamStub.callCount).to.eql(2);
    });

    it('should create the tap result files if result format is specified', async () => {
      const config = {
        dirPath: 'path/to/directory',
        resultFormat: 'tap'
      } as OutputDirConfig;
      const testSrv = new TestService(mockConnection);
      await testSrv.writeResultFiles(testResultData, config);

      expect(
        createStreamStub.calledWith(
          join(config.dirPath, `test-result-${testRunId}-tap.txt`)
        )
      ).to.be.true;
      expect(tapSpy.calledOnce).to.be.true;
      expect(createStreamStub.callCount).to.eql(2);
    });

    it('should create any files provided in fileInfos', async () => {
      const config = {
        dirPath: 'path/to/directory',
        fileInfos: [
          { filename: `test-result-myFile.json`, content: { summary: {} } }
        ]
      } as OutputDirConfig;
      const testSrv = new TestService(mockConnection);
      await testSrv.writeResultFiles(testResultData, config);

      expect(
        createStreamStub.calledWith(
          join(config.dirPath, `test-result-myFile.json`)
        )
      ).to.be.true;
      expect(stringifySpy.callCount).to.eql(1);
      expect(createStreamStub.callCount).to.eql(2);
    });

    it('should create code coverage files if set to true', async () => {
      const config = {
        dirPath: 'path/to/directory'
      } as OutputDirConfig;
      const testSrv = new TestService(mockConnection);
      await testSrv.writeResultFiles(testResultData, config, true);

      expect(
        createStreamStub.calledWith(
          join(config.dirPath, `test-result-${testRunId}-codecoverage.json`)
        )
      ).to.be.true;
      expect(stringifySpy.callCount).to.eql(1);
      expect(createStreamStub.callCount).to.eql(2);
    });
  });

  describe('Build async payload', async () => {
    it('should build async payload for tests without namespace', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        'myClass.myTest'
      );

      expect(payload).to.deep.equal({
        tests: [{ className: 'myClass', testMethods: ['myTest'] }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.calledOnce).to.be.true;
    });

    it('should build async payload for test with namespace when org returns 0 namespaces', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set([]));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        'myNamespace.myClass'
      );

      expect(payload).to.deep.equal({
        tests: [{ className: 'myNamespace', testMethods: ['myClass'] }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.calledOnce).to.be.true;
    });

    it('should build async payload for tests with namespace', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        'myNamespace.myClass'
      );

      expect(payload).to.deep.equal({
        tests: [
          {
            namespace: 'myNamespace',
            className: 'myClass'
          }
        ],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.calledOnce).to.be.true;
    });

    it('should only query for namespaces once when multiple tests are specified', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        'myNamespace.myClass,myNamespace.mySecondClass'
      );

      expect(payload).to.deep.equal({
        tests: [
          {
            namespace: 'myNamespace',
            className: 'myClass'
          },
          {
            namespace: 'myNamespace',
            className: 'mySecondClass'
          }
        ],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.calledOnce).to.be.true;
    });

    it('should build async payload for tests with 3 parts', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        'myNamespace.myClass.myTest'
      );

      expect(payload).to.deep.equal({
        tests: [
          {
            namespace: 'myNamespace',
            className: 'myClass',
            testMethods: ['myTest']
          }
        ],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.notCalled).to.be.true;
    });

    it('should build async payload for tests with only classname', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        'myClass'
      );
      expect(payload).to.deep.equal({
        tests: [{ className: 'myClass' }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.notCalled).to.be.true;
    });

    it('should build async payload for class with only classname', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        undefined,
        'myClass'
      );
      expect(payload).to.deep.equal({
        tests: [{ className: 'myClass' }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.notCalled).to.be.true;
    });

    it('should build async payload for class with namespace', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        undefined,
        'myNamespace.myClass'
      );
      expect(payload).to.deep.equal({
        tests: [{ namespace: 'myNamespace', className: 'myClass' }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.notCalled).to.be.true;
    });

    it('should build async payload for suite', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        undefined,
        undefined,
        'mySuite'
      );
      expect(payload).to.deep.equal({
        suiteNames: 'mySuite',
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.notCalled).to.be.true;
    });
  });

  describe('Query Namespaces', async () => {
    it('should query for installed packages and namespaced orgs', async () => {
      const queryStub = sandboxStub
        .stub(mockConnection, 'query')
        //@ts-ignore
        .resolves({ records: [{ NamespacePrefix: 'myNamespace' }] });
      const testSrv = new TestService(mockConnection);
      await testSrv.queryNamespaces();
      expect(queryStub.calledTwice).to.be.true;
    });

    it('should output set of namespaces from both queries', async () => {
      const queryStub = sandboxStub.stub(mockConnection, 'query');
      queryStub
        .onFirstCall()
        //@ts-ignore
        .resolves({
          records: [
            { NamespacePrefix: 'myNamespace' },
            { NamespacePrefix: 'otherNamespace' }
          ]
        });
      //@ts-ignore
      queryStub.onSecondCall().resolves({
        records: [{ NamespacePrefix: 'otherNamespace' }]
      });

      const testSrv = new TestService(mockConnection);
      const namespaces = await testSrv.queryNamespaces();
      expect(queryStub.calledTwice).to.be.true;
      expect(namespaces).to.deep.equal(
        new Set(['myNamespace', 'otherNamespace'])
      );
    });
  });
});
