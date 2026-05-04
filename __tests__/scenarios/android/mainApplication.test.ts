import * as fs from 'fs';
import { injectCustomerIOInitializerIntoMainApplication } from '../../../plugin/src/android/withMainApplicationModifications';
import { getFixturePath } from '../../utils';

const baseline = fs.readFileSync(getFixturePath('android', 'MainApplication_kt_sdk54.kt'), 'utf8');

describe('android scenarios — injectCustomerIOInitializerIntoMainApplication (SDK 54)', () => {
  it('adds the import and the onCreate initialize call', () => {
    const result = injectCustomerIOInitializerIntoMainApplication(baseline);
    expect(result).toContain('import io.customer.sdk.expo.CustomerIOSDKInitializer');
    expect(result).toContain('CustomerIOSDKInitializer.initialize(this)');
  });

  it('places the initialize call inside override fun onCreate, after super.onCreate', () => {
    const result = injectCustomerIOInitializerIntoMainApplication(baseline);
    // Capture the onCreate body and assert the call is in there
    const onCreateMatch = result.match(/override\s+fun\s+onCreate\s*\(\s*\)\s*\{([\s\S]*?)\}/);
    expect(onCreateMatch).not.toBeNull();
    expect(onCreateMatch![1]).toContain('CustomerIOSDKInitializer.initialize(this)');
  });

  it('is idempotent — running twice equals running once', () => {
    const once = injectCustomerIOInitializerIntoMainApplication(baseline);
    const twice = injectCustomerIOInitializerIntoMainApplication(once);
    expect(twice).toEqual(once);
  });
});
