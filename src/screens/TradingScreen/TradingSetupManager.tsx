import React, {useEffect, useState} from 'react';
import {Alert, Modal, ScrollView, TouchableOpacity, View} from 'react-native';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import PrimaryButton from '../../components/atoms/PrimaryButton';
import CustomInput from '../../components/atoms/CustomInput';
import Icon from '../../components/atoms/Icons';
import useThemeColors from '../../hooks/useThemeColors';
import {gs, hitSlop} from '../../styles/globalStyles';
import {
  tradingPairSchema,
  tradingStrategySchema,
  type Trade,
  type TradingPair,
  type TradingStrategy,
} from '../../trading/model';
import {deleteTradingPair, deleteTradingStrategy, saveTradingPair, saveTradingStrategy} from '../../trading/service';

function useEditor<T extends {id: string; name: string}>(visible: boolean) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setName('');
    setEditing(null);
  }, [visible]);
  return {name, setName, editing, setEditing, saving, setSaving};
}

export default function TradingSetupManager({
  visible,
  strategies,
  pairs,
  trades,
  onClose,
  onSaved,
}: {
  visible: boolean;
  strategies: TradingStrategy[];
  pairs: TradingPair[];
  trades: Trade[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const colors = useThemeColors();
  const strategyEditor = useEditor<TradingStrategy>(visible);
  const pairEditor = useEditor<TradingPair>(visible);

  const saveStrategy = async () => {
    const parsed = tradingStrategySchema.safeParse({
      id: strategyEditor.editing?.id ?? 'new',
      name: strategyEditor.name,
    });
    if (!parsed.success) {
      Alert.alert('Check strategy name', parsed.error.issues[0]?.message ?? 'Enter a valid name.');
      return;
    }
    strategyEditor.setSaving(true);
    try {
      await saveTradingStrategy(parsed.data.name, strategyEditor.editing?.id);
      strategyEditor.setName('');
      strategyEditor.setEditing(null);
      await onSaved();
    } catch (error) {
      Alert.alert('Could not save strategy', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      strategyEditor.setSaving(false);
    }
  };

  const savePair = async () => {
    const parsed = tradingPairSchema.safeParse({id: pairEditor.editing?.id ?? 'new', name: pairEditor.name});
    if (!parsed.success) {
      Alert.alert('Check pair name', parsed.error.issues[0]?.message ?? 'Enter a valid name.');
      return;
    }
    pairEditor.setSaving(true);
    try {
      await saveTradingPair(parsed.data.name, pairEditor.editing?.id);
      pairEditor.setName('');
      pairEditor.setEditing(null);
      await onSaved();
    } catch (error) {
      Alert.alert('Could not save pair', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      pairEditor.setSaving(false);
    }
  };

  const removeStrategy = (strategy: TradingStrategy) => {
    const count = trades.filter(trade => trade.strategy === strategy.id).length;
    Alert.alert(
      `Delete ${strategy.name}?`,
      count
        ? `${count} ${count === 1 ? 'trade still uses' : 'trades still use'} this strategy. Edit or delete those trades first.`
        : 'This removes the strategy from your choices. Your trades will not be deleted.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteTradingStrategy(strategy.id)
              .then(async () => {
                if (strategyEditor.editing?.id === strategy.id) {
                  strategyEditor.setEditing(null);
                  strategyEditor.setName('');
                }
                await onSaved();
              })
              .catch(error =>
                Alert.alert('Could not delete strategy', error instanceof Error ? error.message : 'Please try again.'),
              );
          },
        },
      ],
    );
  };

  const removePair = (pair: TradingPair) => {
    const count = trades.filter(trade => trade.pair === pair.id).length;
    Alert.alert(
      `Delete ${pair.name}?`,
      count
        ? `${count} ${count === 1 ? 'trade still uses' : 'trades still use'} this pair. Edit or delete those trades first.`
        : 'This removes the pair from your choices. Your trades will not be deleted.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteTradingPair(pair.id)
              .then(async () => {
                if (pairEditor.editing?.id === pair.id) {
                  pairEditor.setEditing(null);
                  pairEditor.setName('');
                }
                await onSaved();
              })
              .catch(error =>
                Alert.alert('Could not delete pair', error instanceof Error ? error.message : 'Please try again.'),
              );
          },
        },
      ],
    );
  };

  const renderRow = (
    name: string,
    count: number,
    noun: string,
    onEdit: () => void,
    onDelete: () => void,
    editLabel: string,
    deleteLabel: string,
  ) => (
    <View style={[gs.rowBetweenCenter, gs.p14, gs.rounded12, gs.mb8, {backgroundColor: colors.containerColor}]}>
      <View style={[gs.rowCenter, gs.gap10, gs.flex1]}>
        <View style={[gs.size40, gs.center, gs.rounded12, {backgroundColor: colors.secondaryAccent}]}>
          <Icon name={noun === 'pair' ? 'tag' : 'notebook-pen'} size={18} color={colors.accentGreen} />
        </View>
        <View style={gs.flex1}>
          <PrimaryText size={13} weight="semibold" numberOfLines={1}>
            {name}
          </PrimaryText>
          <PrimaryText size={10} color={colors.secondaryText} style={gs.mt3}>
            {count} {count === 1 ? 'trade' : 'trades'}
          </PrimaryText>
        </View>
      </View>
      <TouchableOpacity
        onPress={onEdit}
        hitSlop={hitSlop}
        style={gs.p8}
        accessibilityRole="button"
        accessibilityLabel={editLabel}>
        <Icon name="pencil" size={17} color={colors.secondaryText} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onDelete}
        hitSlop={hitSlop}
        style={gs.p8}
        accessibilityRole="button"
        accessibilityLabel={deleteLabel}>
        <Icon name="trash-2" size={17} color={colors.accentRed} />
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <PrimaryView colors={colors} useBottomPadding={false}>
        <View style={[gs.rowBetweenCenter, gs.mt15]}>
          <PrimaryText size={20} weight="bold">
            Strategies and pairs
          </PrimaryText>
          <TouchableOpacity onPress={onClose} hitSlop={hitSlop} accessibilityRole="button" accessibilityLabel="Close">
            <Icon name="x" size={24} color={colors.primaryText} />
          </TouchableOpacity>
        </View>
        <PrimaryText size={11} color={colors.secondaryText} style={[gs.mt3, gs.mb5]} numberOfLines={2}>
          Tag every trade with a strategy and a pair so reports stay comparable.
        </PrimaryText>

        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={gs.pb100}>
          <View style={[gs.p14, gs.rounded16, gs.mt20, {backgroundColor: colors.containerColor}]}>
            <PrimaryText size={13} weight="semibold" style={gs.mb10}>
              {strategyEditor.editing ? `Edit ${strategyEditor.editing.name}` : 'Add a new strategy'}
            </PrimaryText>
            <CustomInput
              input={strategyEditor.name}
              setInput={strategyEditor.setName}
              colors={colors}
              placeholder="e.g. Breakout"
              label="Strategy name"
              maxLength={40}
              autoCapitalize="words"
            />
            <View style={[gs.row, gs.gap8, gs.mt10]}>
              {strategyEditor.editing ? (
                <View style={gs.flex1}>
                  <PrimaryButton
                    colors={colors}
                    buttonTitle="Cancel"
                    size="sm"
                    variant="secondary"
                    onPress={() => {
                      strategyEditor.setEditing(null);
                      strategyEditor.setName('');
                    }}
                  />
                </View>
              ) : null}
              <View style={gs.flex1}>
                <PrimaryButton
                  colors={colors}
                  buttonTitle={strategyEditor.editing ? 'Save name' : 'Add strategy'}
                  icon={strategyEditor.editing ? 'check' : 'plus'}
                  size="sm"
                  loading={strategyEditor.saving}
                  onPress={() => void saveStrategy()}
                />
              </View>
            </View>
          </View>

          <PrimaryText size={13} weight="semibold" style={[gs.mt20, gs.mb8]}>
            Available strategies
          </PrimaryText>
          {strategies.map(strategy =>
            renderRow(
              strategy.name,
              trades.filter(trade => trade.strategy === strategy.id).length,
              'strategy',
              () => {
                strategyEditor.setEditing(strategy);
                strategyEditor.setName(strategy.name);
              },
              () => removeStrategy(strategy),
              `Edit ${strategy.name}`,
              `Delete ${strategy.name}`,
            ),
          )}

          <View style={[gs.p14, gs.rounded16, gs.mt20, {backgroundColor: colors.containerColor}]}>
            <PrimaryText size={13} weight="semibold" style={gs.mb10}>
              {pairEditor.editing ? `Edit ${pairEditor.editing.name}` : 'Add a new pair'}
            </PrimaryText>
            <CustomInput
              input={pairEditor.name}
              setInput={pairEditor.setName}
              colors={colors}
              placeholder="e.g. SOL"
              label="Pair name"
              maxLength={20}
              autoCapitalize="characters"
            />
            <View style={[gs.row, gs.gap8, gs.mt10]}>
              {pairEditor.editing ? (
                <View style={gs.flex1}>
                  <PrimaryButton
                    colors={colors}
                    buttonTitle="Cancel"
                    size="sm"
                    variant="secondary"
                    onPress={() => {
                      pairEditor.setEditing(null);
                      pairEditor.setName('');
                    }}
                  />
                </View>
              ) : null}
              <View style={gs.flex1}>
                <PrimaryButton
                  colors={colors}
                  buttonTitle={pairEditor.editing ? 'Save name' : 'Add pair'}
                  icon={pairEditor.editing ? 'check' : 'plus'}
                  size="sm"
                  loading={pairEditor.saving}
                  onPress={() => void savePair()}
                />
              </View>
            </View>
          </View>

          <PrimaryText size={13} weight="semibold" style={[gs.mt20, gs.mb8]}>
            Available pairs
          </PrimaryText>
          {pairs.map(pair =>
            renderRow(
              pair.name,
              trades.filter(trade => trade.pair === pair.id).length,
              'pair',
              () => {
                pairEditor.setEditing(pair);
                pairEditor.setName(pair.name);
              },
              () => removePair(pair),
              `Edit ${pair.name}`,
              `Delete ${pair.name}`,
            ),
          )}
        </ScrollView>
      </PrimaryView>
    </Modal>
  );
}
