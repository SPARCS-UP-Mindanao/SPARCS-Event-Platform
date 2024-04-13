import { FC, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FormProvider } from 'react-hook-form';
import Button from '@/components/Button';
import { DataTable } from '@/components/DataTable';
import { FormItem, FormLabel, FormError, FormDescription } from '@/components/Form';
import Input from '@/components/Input';
import Modal from '@/components/Modal';
import Tooltip from '@/components/Tooltip';
import { getAllDiscounts } from '@/api/discounts';
import { Discount, OrganizationDiscount, enabledDiscountStatus } from '@/model/discount';
import { Event, EventStatus } from '@/model/events';
import { useApiQuery } from '@/hooks/useApi';
import { useDiscountForm } from '@/hooks/useDiscountForm';
import { discountColumns } from './DiscountColumns';

const CreateDiscoutFormItems = () => (
  <>
    <FormItem name="organizationName">
      {({ field }) => (
        <div className="flex flex-col space-y-2">
          <FormLabel>Discount Recipient</FormLabel>
          <Input type="text" {...field} />
          <FormDescription>Enter the organization you want to give discounts to</FormDescription>
          <FormError />
        </div>
      )}
    </FormItem>
    <FormItem name="discountPercentage">
      {({ field }) => (
        <div className="flex flex-col space-y-2">
          <FormLabel>Discount Percentage (%)</FormLabel>
          <Input type="number" {...field} />
          <FormError />
        </div>
      )}
    </FormItem>
    <FormItem name="quantity">
      {({ field }) => (
        <div className="flex flex-col space-y-2">
          <FormLabel>Quantity</FormLabel>
          <Input type="number" min="0" step="1" {...field} />
          <FormDescription>Enter the number of discounts you want to give</FormDescription>
          <FormError />
        </div>
      )}
    </FormItem>
  </>
);

interface DiscountCodeListProps {
  discounts: Discount[];
}

const copyDiscountCodes = (organization: OrganizationDiscount | null, discounts?: Discount[]) => {
  if (organization && !discounts) {
    const discountCodes = organization.discounts.reduce((acc, discount) => {
      return `${acc}${discount.entryId}${discount.claimed ? ` (Claimed)` : ''}\n`;
    }, `Here are the discount codes for ${organization.organizationId}:\n\n`);

    return navigator.clipboard.writeText(discountCodes);
  } else if (discounts) {
    const message = organization ? `Here are the discount codes for ${organization.organizationId}:\n\n` : 'Here are the discount codes:\n\n';
    const discountCodes = discounts.reduce((acc, discount) => {
      return `${acc}${discount.entryId}${discount.claimed ? ` (Claimed)` : ''}\n`;
    }, message);
    return navigator.clipboard.writeText(discountCodes);
  }
};

const DiscountCodeList = ({ discounts }: DiscountCodeListProps) => {
  return (
    <div>
      <ul>
        {discounts.map((discount) => {
          return (
            <li key={discount.entryId} className="w-full">
              {discount.entryId}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

interface CreateDiscountModalProps {
  eventId: string;
  disabled: boolean;
  refetch: () => void;
}
const CreateDiscountModal = ({ eventId, disabled, refetch }: CreateDiscountModalProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCopyClicked, setIsCopyClicked] = useState(false);
  const { form, submit, discounts, showDiscountCodes, setShowDiscountCodes } = useDiscountForm(eventId);

  const handleSubmit = async () => await submit();
  const handleClose = () => {
    setIsModalOpen(false);
    setShowDiscountCodes(false);
    setIsCopyClicked(false);
    form.reset();
    refetch();
  };

  const successButton = () => {
    if (showDiscountCodes) {
      const onClick = () => {
        setIsCopyClicked(true);
        copyDiscountCodes(null, discounts);
      };
      return (
        <Button onClick={onClick} type="submit" icon={isCopyClicked ? 'Check' : 'Copy'}>
          {isCopyClicked ? 'Copied to clipboard' : ' Copy discount codes'}
        </Button>
      );
    }

    return (
      <Button loading={form.formState.isSubmitting} onClick={handleSubmit} type="submit">
        Create
      </Button>
    );
  };

  const footer = (
    <div className="flex space-x-2">
      <Button variant="ghost" onClick={handleClose} disabled={form.formState.isSubmitting}>
        {showDiscountCodes ? 'Close' : 'Cancel'}
      </Button>
      {successButton()}
    </div>
  );

  return (
    <div className="px-4">
      <Modal
        modalTitle="Create Discount"
        trigger={<Button disabled={disabled}>Create Discount</Button>}
        modalFooter={footer}
        closable={!form.formState.isSubmitting && !showDiscountCodes}
        visible={isModalOpen}
        onOpenChange={setIsModalOpen}
      >
        {showDiscountCodes ? (
          <DiscountCodeList discounts={discounts} />
        ) : (
          <FormProvider {...form}>
            <main className="w-full">
              <CreateDiscoutFormItems />
            </main>
          </FormProvider>
        )}
      </Modal>
    </div>
  );
};

interface DiscountHeaderProps {
  organization: OrganizationDiscount;
}

const DiscountHeader: FC<DiscountHeaderProps> = ({ organization }) => {
  return (
    <div className="inline-flex justify-center items-center">
      <h3>{`Recipient: ${organization.organizationId}`}</h3>
      <Tooltip toolTipContent="Copy discount codes" side="right">
        <Button size="icon" icon="Copy" variant="ghost" className="ml-4" onClick={() => copyDiscountCodes(organization)} />
      </Tooltip>
    </div>
  );
};

interface DiscountTablesProps {
  organizations: OrganizationDiscount[];
  status: EventStatus;
  isPaidEvent: boolean;
  isFetching: boolean;
}

const DiscountTables = ({ organizations, status, isPaidEvent, isFetching }: DiscountTablesProps) => {
  if (isFetching || !organizations.length) {
    const getNoDataText = () => {
      if (isPaidEvent) {
        return 'No discounts found';
      }

      if (isPaidEvent && !enabledDiscountStatus.includes(status)) {
        return `Discounts are disabled for events in ${status} status`;
      }

      return 'Discounts are disabled for free events';
    };

    return <DataTable columns={discountColumns} data={[]} loading={isFetching} noDataText={getNoDataText()} />;
  }

  return (
    <>
      {organizations.map((organization) => (
        <div key={organization.organizationId} className="w-full">
          <DiscountHeader organization={organization} />
          <DataTable columns={discountColumns} data={organization.discounts} />
        </div>
      ))}
    </>
  );
};

const AdminEventDiscounts: FC = () => {
  const { eventId, paidEvent, status } = useOutletContext<Event>();
  const { data: response, isFetching, refetch } = useApiQuery(getAllDiscounts(eventId));

  const discountsDisabled = isFetching || !paidEvent || !enabledDiscountStatus.includes(status);

  return (
    <section className="flex flex-col gap-6 items-center">
      <div className="inline-flex justify-center items-center space-x-4">
        <h2>Discounts</h2>
        <Tooltip toolTipContent="Refresh discounts" side="right">
          <Button variant="outline" disabled={!paidEvent} loading={isFetching} size="icon" icon="RotateCw" onClick={() => refetch()} />
        </Tooltip>
      </div>
      <CreateDiscountModal disabled={discountsDisabled} eventId={eventId} refetch={refetch} />
      <DiscountTables organizations={response?.data || []} status={status} isPaidEvent={paidEvent} isFetching={isFetching} />
    </section>
  );
};

const AdminEventDiscountsPage = () => {
  return <AdminEventDiscounts />;
};

export const Component = AdminEventDiscountsPage;

export default AdminEventDiscountsPage;
