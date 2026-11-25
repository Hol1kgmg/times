export const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // 権限で断られたときは、コピーできたと示さなければ仕様を満たす
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      return false;
    }
    throw error;
  }
};
