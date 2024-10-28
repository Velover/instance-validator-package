export default function CountElement<T extends defined, Q>(
  array: readonly T[],
  search_element: Q,
  selector?: (item: T) => Q,
) {
  let amount = 0;

  for (const element of array) {
    if ((selector?.(element) ?? element) === search_element) {
      ++amount;
    }
  }
  return amount;
}