const { withAndroidColors, withAndroidStyles, withInfoPlist } = require('expo/config-plugins');

// Keep native controls light around the app's parchment UI without an extra
// runtime module. The Infinity day/night choice remains its own scene setting.
module.exports = config => {
  config = withAndroidStyles(config, result => {
    const theme = result.modResults.resources.style?.find(style => style.$.name === 'AppTheme');
    if (!theme) throw new Error('The Android app theme was not generated.');
    theme.$.parent = 'Theme.AppCompat.Light.NoActionBar';
    theme.item = (theme.item || []).filter(item => item.$.name !== 'android:forceDarkAllowed');
    theme.item.push({ $: { name: 'android:forceDarkAllowed' }, _: 'false' });
    const launch = result.modResults.resources.style?.find(style => style.$.name === 'Theme.App.SplashScreen');
    if (launch) {
      const startup = {
        'android:windowBackground': '@color/splashscreen_background',
        'android:windowSplashScreenBackground': '@color/splashscreen_background',
        'android:windowSplashScreenAnimatedIcon': '@android:color/transparent',
        'android:windowSplashScreenIconBackgroundColor': '@color/splashscreen_background',
      };
      launch.item = (launch.item || []).filter(item => !(item.$.name in startup));
      launch.item.push(...Object.entries(startup).map(([name,value]) => ({ $: { name }, _: value })));
    }
    return result;
  });
  config = withAndroidColors(config, result => {
    const colors = result.modResults.resources;
    colors.color = (colors.color || []).filter(color => color.$.name !== 'splashscreen_background');
    colors.color.push({ $: { name: 'splashscreen_background' }, _: '#F8F4EA' });
    return result;
  });
  return withInfoPlist(config, result => { result.modResults.UIUserInterfaceStyle = 'Light'; return result; });
};
