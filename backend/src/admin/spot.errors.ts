export class DuplicateSpotNumberError extends Error {
  constructor() {
    super("Spot number already exists in this parking lot");
    this.name = "DuplicateSpotNumberError";
  }
}
