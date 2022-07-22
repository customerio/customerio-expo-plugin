declare type CIOConfigProps = {
  iosDeploymentTarget?: string;
};

type OptionalKeys<T> = {
  [K in keyof T]: undefined extends T[K] ? never : K;
}[keyof T];

type RequiredProps = Exclude<OptionalKeys<CIOConfigProps>, undefined>;

declare module 'xcode' {
  interface xcode {
    project(projPath: string): any;
  }

  const xcode: xcode;
  export default xcode;
}
