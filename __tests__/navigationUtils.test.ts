import type {NavigationContainerRef} from '@react-navigation/native';
import type {GestureResponderEvent} from 'react-native';
import type {HomeStackParamList} from '../src/navigation/types';
import {goBack, setNavigationRef} from '../src/utils/navigationUtils';

jest.mock('@react-navigation/native', () => ({
  CommonActions: {goBack: () => ({type: 'GO_BACK'})},
}));

const dispatch = jest.fn();
beforeEach(() => {
  dispatch.mockReset();
  setNavigationRef({dispatch} as unknown as NavigationContainerRef<HomeStackParamList>);
});

it('accepts the press event passed by a header back button without calling it', () => {
  const event = {nativeEvent: {pageX: 12, pageY: 20}} as GestureResponderEvent;
  // AppHeader forwards its callback to TouchableOpacity, which passes an event.
  expect(() => goBack(event)).not.toThrow();
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(dispatch).toHaveBeenCalledWith({type: 'GO_BACK'});
});

it('dispatches back navigation without a callback', () => {
  expect(goBack()).toBe(true);
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(dispatch).toHaveBeenCalledWith({type: 'GO_BACK'});
});

it('preserves real callbacks and runs them after dispatch', () => {
  const callback = jest.fn(() => expect(dispatch).toHaveBeenCalledWith({type: 'GO_BACK'}));
  expect(goBack(callback)).toBe(true);
  expect(callback).toHaveBeenCalledTimes(1);
});

it('does not run a callback if dispatch throws', () => {
  dispatch.mockImplementationOnce(() => {
    throw new Error('Navigation failed');
  });
  const callback = jest.fn();
  expect(() => goBack(callback)).toThrow('Navigation failed');
  expect(callback).not.toHaveBeenCalled();
});

it('does not run callbacks without a navigation reference', () => {
  setNavigationRef(null as never);
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const callback = jest.fn();
    expect(goBack(callback)).toBe(false);
    expect(callback).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
});
