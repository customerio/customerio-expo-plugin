#import <Foundation/Foundation.h>

@interface CioLifecycleProbeBootstrapSupport : NSObject
+ (void)start;
@end

@interface CioLifecycleProbeBootstrap : NSObject
@end

@implementation CioLifecycleProbeBootstrap

+ (void)load {
  [CioLifecycleProbeBootstrapSupport start];
}

@end
