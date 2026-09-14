const { withAndroidStyles, withInfoPlist } = require('expo/config-plugins');

// Keep native controls light around the app's parchment UI without an extra
// runtime module. The Infinity day/night choice remains its own scene setting.
module.exports = config => {
  config = withAndroidStyles(config, result => {
    const theme = result.modResults.resources.style?.find(style => style.$.name === 'AppTheme');
    if (!theme) throw new Error('The Android app theme was not generated.');
    theme.$.parent = 'Theme.AppCompat.Light.NoActionBar';
    theme.item = (theme.item || []).filter(item => item.$.name !== 'android:forceDarkAllowed');
    theme.item.push({ $: { name: 'android:forceDarkAllowed' }, _: 'false' });
    return result;
  });
  return withInfoPlist(config, result => { result.modResults.UIUserInterfaceStyle = 'Light'; return result; });
};
