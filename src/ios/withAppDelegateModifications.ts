import { ConfigPlugin, withAppDelegate } from '@expo/config-plugins';
import { getAppDelegateHeaderFilePath } from '@expo/config-plugins/build/ios/Paths';

import {
  CIO_APPDELEGATEDECLARATION_REGEX,
  CIO_APPDELEGATEHEADER_REGEX,
  CIO_APPDELEGATEHEADER_SNIPPET,
  CIO_CONFIGURECIOSDKPUSHNOTIFICATION_SNIPPET,
  CIO_DIDFAILTOREGISTERFORREMOTENOTIFICATIONSWITHERRORFULL_REGEX,
  CIO_DIDFAILTOREGISTERFORREMOTENOTIFICATIONSWITHERROR_REGEX,
  CIO_DIDFAILTOREGISTERFORREMOTENOTIFICATIONSWITHERROR_SNIPPET,
  CIO_DIDFINISHLAUNCHINGMETHOD_REGEX,
  CIO_DIDRECEIVENOTIFICATIONRESPONSEHANDLER_SNIPPET,
  CIO_DIDREGISTERFORREMOTENOTIFICATIONSWITHDEVICETOKEN_REGEX,
  CIO_DIDREGISTERFORREMOTENOTIFICATIONSWITHDEVICETOKEN_SNIPPET,
  CIO_PUSHNOTIFICATIONHANDLERDECLARATION_SNIPPET,
  CIO_WILLPRESENTNOTIFICATIONHANDLER_SNIPPET,
} from '../helpers/constants/ios';
import {
  injectCodeByMultiLineRegex,
  injectCodeByMultiLineRegexAndReplaceLine,
} from '../helpers/utils/codeInjection';
import { FileManagement } from '../helpers/utils/fileManagement';
import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';

const pushCodeSnippets = [
  CIO_DIDRECEIVENOTIFICATIONRESPONSEHANDLER_SNIPPET,
  CIO_WILLPRESENTNOTIFICATIONHANDLER_SNIPPET,
];

const additionalMethodsForPushNotifications = `${pushCodeSnippets.join(
  '\n'
)}\n`; // Join newlines and ensure a newline at the end.

const addImport = (stringContents: string, appName: string) => {
  const addedImport = getImportSnippet(appName);

  stringContents = stringContents.replace(
    /#import "AppDelegate.h"/g,
    `#import "AppDelegate.h"
    ${addedImport}`
  );

  return stringContents;
};

const addNotificationHandlerDeclaration = (stringContents: string) => {
  stringContents = injectCodeByMultiLineRegex(
    stringContents,
    CIO_APPDELEGATEDECLARATION_REGEX,
    CIO_PUSHNOTIFICATIONHANDLERDECLARATION_SNIPPET
  );

  return stringContents;
};

const addNotificationConfiguration = (stringContents: string) => {
  stringContents = injectCodeByMultiLineRegex(
    stringContents,
    CIO_DIDFINISHLAUNCHINGMETHOD_REGEX,
    CIO_CONFIGURECIOSDKPUSHNOTIFICATION_SNIPPET
  );

  return stringContents;
};

const addDidFailToRegisterForRemoteNotificationsWithError = (
  stringContents: string
) => {
  stringContents = injectCodeByMultiLineRegexAndReplaceLine(
    stringContents,
    CIO_DIDFAILTOREGISTERFORREMOTENOTIFICATIONSWITHERROR_REGEX,
    CIO_DIDFAILTOREGISTERFORREMOTENOTIFICATIONSWITHERROR_SNIPPET
  );

  return stringContents;
};

const addDidRegisterForRemoteNotificationsWithDeviceToken = (
  stringContents: string
) => {
  stringContents = injectCodeByMultiLineRegexAndReplaceLine(
    stringContents,
    CIO_DIDREGISTERFORREMOTENOTIFICATIONSWITHDEVICETOKEN_REGEX,
    CIO_DIDREGISTERFORREMOTENOTIFICATIONSWITHDEVICETOKEN_SNIPPET
  );

  return stringContents;
};

const addAdditionalMethodsForPushNotifications = (stringContents: string) => {
  stringContents = injectCodeByMultiLineRegex(
    stringContents,
    CIO_DIDFAILTOREGISTERFORREMOTENOTIFICATIONSWITHERRORFULL_REGEX,
    additionalMethodsForPushNotifications
  );

  return stringContents;
};

const addAppdelegateHeaderModification = (stringContents: string) => {
  stringContents = injectCodeByMultiLineRegexAndReplaceLine(
    stringContents,
    CIO_APPDELEGATEHEADER_REGEX,
    CIO_APPDELEGATEHEADER_SNIPPET
  );

  return stringContents;
};

export const withAppDelegateModifications: ConfigPlugin<
  CustomerIOPluginOptionsIOS
> = (configOuter, props) => {
  return withAppDelegate(configOuter, async (config) => {
    let stringContents = config.modResults.contents;
    const regex = new RegExp(
      `#import <${config.modRequest.projectName}-Swift.h>`
    );
    const match = stringContents.match(regex);

    if (!match) {
      const headerPath = getAppDelegateHeaderFilePath(
        config.modRequest.projectRoot
      );
      let headerContent = await FileManagement.read(headerPath);
      headerContent = addAppdelegateHeaderModification(headerContent);
      FileManagement.write(headerPath, headerContent);

      stringContents = addImport(
        stringContents,
        config.modRequest.projectName as string
      );
      stringContents = addNotificationHandlerDeclaration(stringContents);

      // any other value would be treated as true, it has to be explicitly false to disable
      if (
        props.disableNotificationRegistration !== undefined &&
        props.disableNotificationRegistration === false
      ) {
        stringContents = addNotificationConfiguration(stringContents);
      }
      stringContents = addAdditionalMethodsForPushNotifications(stringContents);
      stringContents =
        addDidFailToRegisterForRemoteNotificationsWithError(stringContents);
      stringContents =
        addDidRegisterForRemoteNotificationsWithDeviceToken(stringContents);

      config.modResults.contents = stringContents;
    } else {
      console.log('Customerio AppDelegate changes already exist. Skipping...');
    }

    return config;
  });
};
function getImportSnippet(appName: string) {
  return `
// Add swift bridge imports
#import <ExpoModulesCore-Swift.h>
#import <${appName}-Swift.h>
  `;
}
