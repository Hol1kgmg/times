// 本物は Node の AsyncLocalStorage を読み込み、Storybook のブラウザでは動かない
export const useServerFn = <T>(f: T): T => f;
