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
      assertPushRemovalIsSafe('/app/ios', 'Example', false)
    ).not.toThrow();
  });

  it('allows an existing push project while push stays enabled', () => {
    mockExistsSync.mockReturnValue(true);

    expect(() =>
      assertPushRemovalIsSafe('/app/ios', 'Example', true)
    ).not.toThrow();
    expect(mockExistsSync).not.toHaveBeenCalled();
  });

  it('requires a clean prebuild before dropping push pods from a generated project', () => {
    mockExistsSync.mockReturnValue(true);

    expect(() =>
      assertPushRemovalIsSafe('/app/ios', 'Example', false)
    ).toThrow('npx expo prebuild --clean --platform ios');
    expect(mockExistsSync).toHaveBeenCalledWith(
      '/app/ios/Example/CioSdkAppDelegateHandler.swift'
    );
  });
});
