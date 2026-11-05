// Entry file. Code that has to run without the app mounting, such as the silent push handler, is
// imported here before Expo Router's entry.
import "./helpers/BackgroundPushHandler";
import "expo-router/entry";
