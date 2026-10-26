import { HttpErrorResponse } from '@angular/common/http';
import { problemMessage } from './problem-message';

describe('problemMessage', () => {
  it('problemMessage_ProblemDetailsWithDetail_ReturnsDetail', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { title: 'Bad Request', detail: 'page is out of range' },
    });

    expect(problemMessage(error)).toBe('page is out of range');
  });

  it('problemMessage_TitleOnly_ReturnsTitle', () => {
    const error = new HttpErrorResponse({ status: 500, error: { title: 'Server error' } });

    expect(problemMessage(error)).toBe('Server error');
  });

  it('problemMessage_ValidationErrors_ReturnsFieldMessages', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: {
        title: 'One or more validation errors occurred.',
        errors: {
          pageSize: ["'Page Size' must be between 1 and 100."],
          sort: ['Each sort field may appear only once.'],
        },
      },
    });

    expect(problemMessage(error)).toBe(
      "'Page Size' must be between 1 and 100. Each sort field may appear only once.",
    );
  });

  it('problemMessage_StatusZero_ReturnsCannotReachServer', () => {
    const error = new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') });

    expect(problemMessage(error)).toBe(
      "Can't reach the server. Check your connection and try again.",
    );
  });

  it('problemMessage_OtherError_ReturnsGenericMessage', () => {
    expect(problemMessage(new Error('boom'))).toBe('Something went wrong. Try again.');
  });
});
