import fs from 'fs';
import { assertPushRemovalIsSafe } from '../../plugin/src/ios/withXcodeProject';

const mockExistsSync = jest.spyOn(fs, 'existsSync');

describe('assertPushRemovalIsSafe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  it('allows a clean no-push project', () => {
    expect(() =>
      assertPushRemovalIsSafe('/app/ios', 'Example')
    ).not.toThrow();
  });

  it('requires a clean prebuild before dropping push pods from a generated project', () => {
    mockExistsSync.mockReturnValue(true);

    expect(() =>
      assertPushRemovalIsSafe('/app/ios', 'Example')
    ).toThrow('npx expo prebuild --clean --platform ios');
    expect(mockExistsSync).toHaveBeenCalledWith(
      '/app/ios/Example/CioSdkAppDelegateHandler.swift'
    );
  });
});
