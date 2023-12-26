type LoadableStatus<T> =
  | { status: "pending" }
  | { status: "fulfilled"; value: T }
  | { status: "rejected"; error: unknown };

export const createLoadable = <T>(promise: Promise<T>) => {
  let loadableStatus: LoadableStatus<T> = {
    status: "pending",
  };

  const suspender = promise.then(
    (res) => {
      loadableStatus = {
        status: "fulfilled",
        value: res,
      };
    },
    (err) => {
      loadableStatus = {
        status: "rejected",
        error: err,
      };
    }
  );

  return () => {
    switch (loadableStatus.status) {
      case "pending":
        throw suspender;
      case "rejected":
        throw loadableStatus.error;
      default:
        return loadableStatus.value;
    }
  };
};
