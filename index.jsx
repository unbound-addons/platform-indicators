import Plugin from '@structures/plugin';

import { appendCSS, findInReactTree } from '@utilities';
import { bulk, filters } from '@webpack';
import { Flux } from '@webpack/common';
import { create } from '@patcher';

import AnimatedStatus from './components/AnimatedStatus';
import ClientStatuses from './components/ClientStatuses';
import Settings from './components/Settings';

const Patcher = create('platform-indicators');

const [
   StatusStore,
   Status,
   Colors,
   Users,
   Dividers,
   PrivateChannel,
   MemberListItem,
   Store
] = bulk(
   filters.byProps('getStatusColor'),
   filters.byDisplayName('FluxContainer(Status)'),
   filters.byProps('isValidHex'),
   filters.byProps('getUser', 'getCurrentUser'),
   filters.byProps('transparent', 'divider'),
   filters.byDisplayName('PrivateChannel'),
   filters.byDisplayName('MemberListItem'),
   filters.byProps('isMobileOnline')
);

export default class extends Plugin {
   start() {
      this.unstyle = appendCSS(this.id, require('./styles'));

      Patcher.after(Store, 'isMobileOnline', () => {
         return false;
      });

      const ConnectedClientStatuses = Flux.connectStores([unbound.apis.settings.store], () => this.settings)(ClientStatuses);
      Patcher.after(Status.prototype, 'render', (self, args, res) => {
         const props = res.props;
         res = res.type(props);

         const tooltip = res.props.children(props);
         tooltip.props.children.type = AnimatedStatus;

         if (props.status !== 'offline') {
            if (!Array.isArray(res)) {
               res = [res];
            }

            res.push(...[
               <div className={Dividers?.divider} />,
               <ConnectedClientStatuses
                  user={Users.getUser(self.props.userId)}
               />
            ]);
         }

         return res;
      });

      Patcher.after(PrivateChannel.prototype, 'render', (self, args, res) => {
         if (!self.props.user) {
            return res;
         }

         const { status, user } = self.props;

         if (typeof res.props.children === 'function') {
            res.props.children = (oldMethod => (props) => {
               const res = oldMethod(props);

               const DecoratorsComponent = findInReactTree(res, n => n.props?.hasOwnProperty('decorators'));
               const decorators = Array.isArray(DecoratorsComponent.props.decorators) ? DecoratorsComponent.props.decorators : [DecoratorsComponent.props.decorators];

               DecoratorsComponent.props.decorators = [
                  ...decorators,
                  <ConnectedClientStatuses status={status} user={user} />
               ];

               return res;
            })(res.props.children);
         }

         return res;
      });

      Patcher.after(MemberListItem.prototype, 'renderDecorators', (self, args, res) => {
         const { status, user } = self.props;

         if (!res.props.children) {
            res.props.children = [];
         } else if (!Array.isArray(res.props.children)) {
            res.props.children = [res.props.children];
         }

         res.props.children.unshift([
            <ConnectedClientStatuses status={status} user={user} />
         ]);

         return res;
      });

      Patcher.after(StatusStore, 'Status', (_, [{ status, color }], res) => {
         const style = res.props.children.props.style;
         if (!color) {
            style.backgroundColor = StatusStore.getStatusColor(status);
         }
      });
   }

   getSettingsPanel() {
      return Settings;
   }

   stop() {
      if (this.unstyle) this.unstyle();
      Patcher.unpatchAll();
   }
};