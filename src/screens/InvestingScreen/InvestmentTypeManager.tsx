import React, {useEffect, useState} from 'react';
import {Alert, Modal, ScrollView, TouchableOpacity, View} from 'react-native';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import PrimaryButton from '../../components/atoms/PrimaryButton';
import CustomInput from '../../components/atoms/CustomInput';
import Icon from '../../components/atoms/Icons';
import useThemeColors from '../../hooks/useThemeColors';
import {gs, hitSlop} from '../../styles/globalStyles';
import {investmentTypeIcon, investmentTypeSchema, type Investment, type InvestmentType} from '../../investments/model';
import {deleteInvestmentType, saveInvestmentType} from '../../investments/service';

export default function InvestmentTypeManager({
  visible,
  types,
  investments,
  onClose,
  onSaved,
}: {
  visible: boolean;
  types: InvestmentType[];
  investments: Investment[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const colors = useThemeColors();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<InvestmentType | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setEditing(null);
  }, [visible]);

  const resetForm = () => {
    setName('');
    setEditing(null);
  };

  const save = async () => {
    const parsed = investmentTypeSchema.safeParse({id: editing?.id ?? 'new', name});
    if (!parsed.success) {
      Alert.alert('Check type name', parsed.error.issues[0]?.message ?? 'Enter a valid name.');
      return;
    }
    setSaving(true);
    try {
      await saveInvestmentType(parsed.data.name, editing?.id);
      resetForm();
      await onSaved();
    } catch (error) {
      Alert.alert('Could not save type', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = (type: InvestmentType) => {
    const count = investments.filter(investment => investment.type === type.id).length;
    Alert.alert(
      `Delete ${type.name}?`,
      count
        ? `${count} ${count === 1 ? 'investment' : 'investments'} will remain and be changed to No type.`
        : 'This removes the type from your choices. Your investments will not be deleted.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteInvestmentType(type.id)
              .then(async () => {
                if (editing?.id === type.id) resetForm();
                await onSaved();
              })
              .catch(error =>
                Alert.alert('Could not delete type', error instanceof Error ? error.message : 'Please try again.'),
              );
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <PrimaryView colors={colors} useBottomPadding={false}>
        <View style={[gs.rowBetweenCenter, gs.mt15]}>
          <PrimaryText size={20} weight="bold">
            Investment types
          </PrimaryText>
          <TouchableOpacity onPress={onClose} hitSlop={hitSlop} accessibilityRole="button" accessibilityLabel="Close">
            <Icon name="x" size={24} color={colors.primaryText} />
          </TouchableOpacity>
        </View>
        <PrimaryText size={11} color={colors.secondaryText} style={[gs.mt3, gs.mb5]} numberOfLines={2}>
          Organize accounts your way, or leave them without a type.
        </PrimaryText>

        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={gs.pb100}>
          <View style={[gs.p14, gs.rounded16, gs.mt20, {backgroundColor: colors.containerColor}]}>
            <PrimaryText size={13} weight="semibold" style={gs.mb10}>
              {editing ? `Edit ${editing.name}` : 'Add a new type'}
            </PrimaryText>
            <CustomInput
              input={name}
              setInput={setName}
              colors={colors}
              placeholder="e.g. Fixed deposit"
              label="Type name"
              maxLength={40}
              autoCapitalize="words"
            />
            <View style={[gs.row, gs.gap8, gs.mt10]}>
              {editing ? (
                <View style={gs.flex1}>
                  <PrimaryButton
                    colors={colors}
                    buttonTitle="Cancel"
                    size="sm"
                    variant="secondary"
                    onPress={resetForm}
                  />
                </View>
              ) : null}
              <View style={gs.flex1}>
                <PrimaryButton
                  colors={colors}
                  buttonTitle={editing ? 'Save name' : 'Add type'}
                  icon={editing ? 'check' : 'plus'}
                  size="sm"
                  loading={saving}
                  onPress={() => void save()}
                />
              </View>
            </View>
          </View>

          <PrimaryText size={13} weight="semibold" style={[gs.mt20, gs.mb8]}>
            Available types
          </PrimaryText>
          {types.length === 0 ? (
            <View style={[gs.p20, gs.rounded16, gs.itemsCenter, {backgroundColor: colors.containerColor}]}>
              <Icon name="tag" size={24} color={colors.secondaryText} />
              <PrimaryText size={12} weight="semibold" style={gs.mt8}>
                No types yet
              </PrimaryText>
              <PrimaryText size={10} color={colors.secondaryText} style={[gs.mt3, gs.textCenter]}>
                That is okay—new and existing investments can stay under No type.
              </PrimaryText>
            </View>
          ) : (
            types.map(type => {
              const count = investments.filter(investment => investment.type === type.id).length;
              return (
                <View
                  key={type.id}
                  style={[gs.rowBetweenCenter, gs.p14, gs.rounded12, gs.mb8, {backgroundColor: colors.containerColor}]}>
                  <View style={[gs.rowCenter, gs.gap10, gs.flex1]}>
                    <View style={[gs.size40, gs.center, gs.rounded12, {backgroundColor: colors.secondaryAccent}]}>
                      <Icon name={investmentTypeIcon(type.id)} size={18} color={colors.accentGreen} />
                    </View>
                    <View style={gs.flex1}>
                      <PrimaryText size={13} weight="semibold" numberOfLines={1}>
                        {type.name}
                      </PrimaryText>
                      <PrimaryText size={10} color={colors.secondaryText} style={gs.mt3}>
                        {count} {count === 1 ? 'investment' : 'investments'}
                      </PrimaryText>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setEditing(type);
                      setName(type.name);
                    }}
                    hitSlop={hitSlop}
                    style={gs.p8}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${type.name}`}>
                    <Icon name="pencil" size={17} color={colors.secondaryText} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => remove(type)}
                    hitSlop={hitSlop}
                    style={gs.p8}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${type.name}`}>
                    <Icon name="trash-2" size={17} color={colors.accentRed} />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>
      </PrimaryView>
    </Modal>
  );
}
