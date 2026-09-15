// Test-only host: run the SDK's Android measureInWindow/inline branch against
// real browser geometry. This does not emulate a device's native renderer.
const web = require('react-native-web');
const callbacks = [];
globalThis.__androidBack = () => [...callbacks].reverse().some(callback => callback());
const dimensions = () => {
  const top = Number(new URLSearchParams(location.search).get('top') || 0);
  return { ...web.Dimensions.get('window'), height: innerHeight - top - 24 };
};
module.exports = { ...web,
  Platform: { ...web.Platform, OS: 'android', select: values => values.android ?? values.native ?? values.default },
  StatusBar: { ...web.StatusBar, currentHeight: 28 },
  Dimensions: { get: name => name === 'window' ? dimensions() : web.Dimensions.get(name), addEventListener: (name, listener) => web.Dimensions.addEventListener(name, event => listener({ ...event, window: dimensions() })) },
  Animated: { ...web.Animated, timing: (value, config) => web.Animated.timing(value, { ...config, useNativeDriver: false }) },
  BackHandler: { addEventListener: (_name, callback) => { callbacks.push(callback); return { remove: () => { const index = callbacks.indexOf(callback); if (index >= 0) callbacks.splice(index, 1); } }; } },
};
