/**
 * Variant denotes Thread variant. Currently only two variants are supported.
 * @public
 */
export enum Variant {
  Raw = 0x55,
  AccessControlled = 0x70, // Supports access control lists
}
